/* =========================================================
   🔒 Premium User App Script - Fully Updated & Sync with Admin
============================================================ */

var firebaseConfig = {
  apiKey: "AIzaSyAHO3ZPYWzTyEcPPNXv4rlxq4ut9fqfeJg",
  authDomain: "hmnayem-b9e55.firebaseapp.com",
  databaseURL: "https://hmnayem-b9e55-default-rtdb.firebaseio.com",
  projectId: "hmnayem-b9e55",
  storageBucket: "hmnayem-b9e55.firebasestorage.app",
  messagingSenderId: "287770671177",
  appId: "1:287770671177:web:7db5b8737e943bb07e2798",
  measurementId: "G-DJZ3S88DBN"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    if (typeof firebase.analytics === "function") firebase.analytics();
}
var database = firebase.database();

/* =========================================================
   👤 জিমেইল লগইন ও ইউজার ডাটা ম্যানেজমেন্ট
============================================================ */
firebase.auth().onAuthStateChanged((user) => {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userPhoto = document.getElementById('userPhoto');
    const idDisplay = document.getElementById('userIdDisplay');

    if (user) {
        // --- 🚫 ১. ব্লক চেক ---
        database.ref('users/' + user.uid + '/isBlocked').on('value', snap => {
            if (snap.val() === true) {
                document.body.innerHTML = `
                <div style="height:100vh; background:#000; color:#ff4b2b; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:20px; font-family:sans-serif;">
                    <h1 style="font-size:50px; margin-bottom:10px;">🚫</h1>
                    <h2>দুঃখিত! আপনাকে ব্লক করা হয়েছে।</h2>
                    <p style="color:#777;">অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
                    <a href="https://wa.me/8801609950083" style="margin-top:20px; color:#00f2fe; text-decoration:none; border:1px solid #00f2fe; padding:10px 20px; border-radius:5px;">যোগাযোগ করুন</a>
                </div>`;
                return;
            }
        });

        // প্রোফাইল সেটআপ
        if(loginBtn) loginBtn.style.display = 'none';
        if(logoutBtn) logoutBtn.style.display = 'block';
        if(userNameDisplay) userNameDisplay.innerText = user.displayName;
        if(userPhoto) userPhoto.innerHTML = `<img src="${user.photoURL}" style="width:100%; height:100%; border-radius:50%;">`;

        // ইউনিক আইডি
        let numId = user.uid.replace(/\D/g, ''); 
        while (numId.length < 10) { numId += Math.floor(Math.random() * 10); }
        let finalCustomerId = numId.substring(0, 10);
        
        if (idDisplay) idDisplay.innerText = finalCustomerId;
        localStorage.setItem('customerID', finalCustomerId);

        // অ্যাডমিন প্যানেলের জন্য ডাটা আপডেট
        database.ref('users/' + user.uid).update({
            uid: user.uid,
            customerId: finalCustomerId,
            name: user.displayName,
            email: user.email,
            photo: user.photoURL,
            lastLogin: new Date().toLocaleString('bn-BD'),
            status: "Active"
        });

        // অর্ডার হিস্ট্রি লোড (অ্যাডমিনের সাথে মিল রেখে allOrders ব্যবহার)
        loadUserOrders(user.uid);

    } else {
        if(loginBtn) loginBtn.style.display = 'flex';
        if(logoutBtn) logoutBtn.style.display = 'none';
        if(userNameDisplay) userNameDisplay.innerText = "গেস্ট ইউজার";
        if(userPhoto) userPhoto.innerHTML = "X";
        if (idDisplay) idDisplay.innerText = "লগইন করুন";
        localStorage.removeItem('customerID');
    }
});

/* =========================================================
   📊 রিয়েল-টাইম অর্ডার হিস্ট্রি (অ্যাডমিন প্যানেল সিঙ্ক)
============================================================ */
function loadUserOrders(uid) {
    const orderDiv = document.getElementById('userOrderSection');
    const orderList = document.getElementById('orderStatusList');
    if(!orderDiv || !orderList) return;

    database.ref('allOrders').orderByChild('userUid').equalTo(uid).on('value', snap => {
        if (snap.exists()) {
            orderDiv.style.display = 'block';
            orderList.innerHTML = ""; // আগের ডাটা মুছে ফ্রেশ করে দেখানোর জন্য
            let orders = [];
            snap.forEach(child => { orders.unshift(child.val()); });

            orders.forEach(o => {
                let statusColor = "#ffcc00"; 
                if(o.status === "Success") statusColor = "#00ff88";
                if(o.status === "Rejected") statusColor = "#ff4b2b";

                orderList.innerHTML += `
                    <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; margin-bottom: 10px; border-left: 4px solid ${statusColor}; border-bottom: 1px solid #333;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <strong style="color: white; font-size: 13px;">${o.title || 'অফার'}</strong>
                            <span style="color: ${statusColor}; font-size: 10px; font-weight: bold;">● ${o.status}</span>
                        </div>
                        <div style="color: #aaa; font-size: 11px; margin-top: 5px;">
                            নাম্বার: ${o.customerNumber} | ৳${o.price} | ${o.time}
                        </div>
                    </div>`;
            });
        } else { orderDiv.style.display = 'none'; }
    });
}

/* =========================================================
   🛒 অর্ডার কনফার্মেশন (১০০% অ্যাডমিন সিঙ্ক)
============================================================ */
function confirmOrder() {
  let num = document.getElementById('custNumber').value;
  let met = document.getElementById('payMethod').value;
  let trx = document.getElementById('trxId').value.trim();
  let myID = localStorage.getItem('customerID') || "N/A";
  let user = firebase.auth().currentUser;
  
  if (!user) { showSmartToast("আগে লগইন করুন!", "⚠️", true); return; }

  if (num.length >= 11 && trx.length >= 8) {
    showSmartToast("অর্ডার পাঠানো হচ্ছে...", "⏳");
    
    let orderData = {
        userUid: user.uid,
        userId: myID,
        userPhoto: user.photoURL,
        title: tempTitle, // অ্যাডমিন প্যানেলে অফারের নাম দেখাবে
        price: tempPrice, // অ্যাডমিন প্যানেলে দাম দেখাবে
        customerNumber: num,
        method: met,
        trxId: trx,
        status: "Pending", 
        time: new Date().toLocaleString('bn-BD'), // অ্যাডমিনের সাথে টাইম ফরম্যাট সিঙ্ক
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    database.ref('allOrders').push(orderData).then(() => {
        showSmartToast("অর্ডার সফল! হিস্ট্রি চেক করুন।", "✅");
        closeOrder();
        document.getElementById('custNumber').value = "";
        document.getElementById('trxId').value = "";
    }).catch(e => { showSmartToast("ব্যর্থ হয়েছে!", "❌", true); });
  } else { showSmartToast("সঠিক তথ্য দিন!", "❌", true); }
}


/* =========================================================
   📱 ফাংশনসমূহ (রিফ্রেশ ফিক্স সহ)
============================================================ */
let currentSim = ""; let tempTitle = ""; let tempPrice = ""; let currentDays = "";
function playSnd(id) { const s = document.getElementById(id); if (s) { s.currentTime = 0; s.play().catch(e => {}); } }

function showSmartToast(message, icon = "✅", isError = false) {
    const toast = document.getElementById('smartToast');
    const toastMsg = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');
    if(!toast) return; 
    toastMsg.innerText = message; toastIcon.innerText = icon;
    if(isError) toast.classList.add('error'); else toast.classList.remove('error');
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 2500);
}

// ধামাকা অফার
let globalDhakaOffer = null;
database.ref('dhakaOffer').on('value', snap => {
    const dhakaBox = document.getElementById('dhakaOfferSection');
    const dhakaText = document.getElementById('dhakaOfferText');
    if(snap.exists() && snap.val().text) {
        globalDhakaOffer = snap.val();
        dhakaText.innerHTML = `<div style="font-weight: bold; color: white;">${globalDhakaOffer.text}</div><div style="font-size: 12px; color: #00f2fe;">৳${globalDhakaOffer.price} | ${globalDhakaOffer.days} দিন</div>`;
        if(dhakaBox) dhakaBox.style.display = 'block'; 
    } else { if(dhakaBox) dhakaBox.style.display = 'none'; }
});

function openDhakaOrder() { if (globalDhakaOffer) { currentDays = globalDhakaOffer.days; order("⚡ " + globalDhakaOffer.text, globalDhakaOffer.price); } }

function openOffers(sim) { 
    playSnd('snd_sim'); 
    currentSim = sim; 
    document.getElementById("homeSection").classList.add("hidden"); 
    document.getElementById("offerSection").classList.remove("hidden"); 
    document.getElementById("headerTitle").innerText = sim + " Offers";
    // সিম পরিবর্তনের সময় লিস্ট ক্লিয়ার করার জন্য
    document.getElementById("offerList").innerHTML = "";
}

function loadOffers(days) {
  playSnd('snd_day'); 
  currentDays = days;
  const list = document.getElementById("offerList");


// ১. রিফ্রেশ ফিক্স: আগের ডাটা মুছে ফেলার জন্য
list.innerHTML = '<p style="text-align:center; color:#00f2fe; padding:20px;">অফার লোড হচ্ছে...</p>';

database.ref('offers/' + currentSim + '/' + days).once('value', snap => {
    list.innerHTML = ""; // ২. ডাটা আসার পর আবার ক্লিয়ার করে ফ্রেশ ডাটা বসানো
    if (!snap.exists()) { 
        list.innerHTML = '<p style="text-align:center; color:#ff4b2b; padding:20px;">দুঃখিত, কোনো অফার নেই।</p>'; 
        return; 
    }
    snap.forEach(child => {
        let o = child.val();
        list.innerHTML += `
        <div class="offer-card" style="height: auto; min-height: auto; padding: 12px; margin-bottom: 10px; display: flex; align-items: center;">
            <div style="flex: 1; z-index: 2;">
                <h4 style="margin: 0; color: white; line-height: 1.2; font-size: 15px;">${o.title}</h4>
                <p style="margin: 4px 0; font-size: 11px; color: #ffcc00; line-height: 1;">শর্তঃ ${o.condition || 'কোনো শর্ত নেই'}</p>
                <p style="margin: 2px 0; font-size: 11px; color: #ff4b2b; line-height: 1;">দোকান মুল্য ঃ <del>৳${o.dokanPrice || '0'}</del></p>
                <p style="margin: 2px 0; color: #00f2fe; font-weight: bold; font-size: 17px; line-height: 1.2;">আমাদের মুল্য ঃ ৳${o.price}</p>
            </div>
            <button onclick="order('${o.title.replace(/'/g, "\\'")}', '${o.price}')" style="background:linear-gradient(135deg, #ff00f1, #7aff00); color:#000; border:none; padding:8px 15px; border-radius:20px; font-weight:bold; cursor:pointer; margin-left:10px; white-space: nowrap;">🛒কিনুন</button>
        </div>`;
    });
});
}
function goBack() { playSnd('snd_back'); document.getElementById("offerSection").classList.add("hidden"); document.getElementById("homeSection").classList.remove("hidden"); 
document.getElementById("headerTitle").innerText = "কম দামে সেরা অফার "; 
}


function order(title, price) {
  var user = firebase.auth().currentUser;
  if (!user) { showSmartToast("📬অর্ডার করতে আগে লগইন করুন!", "⚠️", true); toggleModal(); return; }
  playSnd('snd_buy'); tempTitle = title; tempPrice = price;
  document.getElementById('offNameText').innerText = title;
  document.getElementById('offPriceText').innerText = "দামঃ ৳ " + price;
  document.getElementById('orderModal').style.display = 'flex';
}

function closeOrder() { playSnd('snd_back'); document.getElementById('orderModal').style.display = 'none'; }
function copyNumber() { let num = document.getElementById('paymentNumDisplay').innerText; navigator.clipboard.writeText(num).then(() => { playSnd('snd_set'); showSmartToast("কপি হয়েছে!", "📱"); }); }
function copyUserId() { const id = document.getElementById('userIdDisplay').innerText; if(id === "লগইন করুন" || !id) return; navigator.clipboard.writeText(id).then(() => { playSnd('snd_set'); showSmartToast("আইডি কপি হয়েছে!", "🆔"); }); }
function toggleModal() { playSnd('snd_set'); document.getElementById("settingsModal").classList.toggle("hidden"); }
function openFullGuide() { playSnd('snd_set'); document.getElementById("fullGuidePage").classList.remove("hidden"); }
function closeFullGuide() { playSnd('snd_back'); document.getElementById("fullGuidePage").classList.add("hidden"); }

function googleLogin() { var p = new firebase.auth.GoogleAuthProvider(); firebase.auth().signInWithPopup(p).then(() => showSmartToast("লগইন সফল!", "✅")).catch(e => showSmartToast("লগইন ব্যর্থ!", "❌", true)); }
function googleLogout() { firebase.auth().signOut().then(() => { showSmartToast("লগআউট হয়েছে", "ℹ️"); location.reload(); }); }