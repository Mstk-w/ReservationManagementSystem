const { initializeTestEnvironment, assertFails, assertSucceeds } =
  require("@firebase/rules-unit-testing");
const { getFirestore, doc, setDoc, getDoc, addDoc, collection, Timestamp } =
  require("firebase/firestore");
const fs = require("fs");

(async () => {
  const testEnv = await initializeTestEnvironment({
    projectId: "demo-campagne",
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8") }
  });

  // 事前データ（管理者メール・商品）
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = getFirestore(ctx);
    await setDoc(doc(db, "settings", "admins"), { emails: ["admin@example.com"] });
    await setDoc(doc(db, "products", "p1"), { name:"商品", price:100, enabled:true, seasonal:false, sort_order:1 });
  });

  const unauth = testEnv.unauthenticatedContext();
  const admin  = testEnv.authenticatedContext("uid1", { email: "admin@example.com" });
  const unauthDb = getFirestore(unauth);
  const adminDb  = getFirestore(admin);

  // 公開read
  await assertSucceeds(getDoc(doc(unauthDb, "products/p1")));
  await assertFails(setDoc(doc(unauthDb, "products/pX"), {name:"x",price:1,enabled:true}));

  // 予約 create（正常最小）
  const base = {
    status:"reserved",
    pickup_date:"2099-08-23",
    pickup_time:"11:30",
    pickup_ts: Timestamp.fromDate(new Date("2099-08-23T11:30:00+09:00")),
    payment_method:"cash",
    customer:{email:"taro@example.com"},
    items:[{product_id:"p1", name:"商品", unit_price:100, qty:1, line_total:100}],
    subtotal:100, total:100
  };
  await assertSucceeds(addDoc(collection(unauthDb, "reservations"), base));

  // read 不可（未認証）
  await assertFails(getDoc(doc(unauthDb, "reservations/any")));

  // 異常：過去 pickup_ts
  await assertFails(addDoc(collection(unauthDb, "reservations"), {
    ...base, pickup_ts: Timestamp.fromDate(new Date(Date.now() - 3600_000))
  }));
  // 異常：items 0件
  await assertFails(addDoc(collection(unauthDb, "reservations"), {
    ...base, items:[]
  }));
  // 異常：items 多すぎ
  await assertFails(addDoc(collection(unauthDb, "reservations"), {
    ...base, items: new Array(51).fill(base.items[0])
  }));

  // 管理者は read / update 可
  await assertSucceeds(getDoc(doc(adminDb, "products/p1")));
  await assertSucceeds(setDoc(doc(adminDb, "products/p1"), {price:120}, {merge:true}));

  console.log("✅ Firestore rules tests passed");
  await testEnv.cleanup();
})();
