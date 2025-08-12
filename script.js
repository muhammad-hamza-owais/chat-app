// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  push,
  onChildAdded,
  query,
  orderByChild,
  equalTo,
  get,
  serverTimestamp,
  onDisconnect,
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBzNRGongnhdxtBZYkNm9aXUCoftyWNYek",
  authDomain: "realtime-chatapp-a7302.firebaseapp.com",
  databaseURL: "https://realtime-chatapp-a7302-default-rtdb.firebaseio.com",
  projectId: "realtime-chatapp-a7302",
  storageBucket: "realtime-chatapp-a7302.appspot.com",
  messagingSenderId: "608665539969",
  appId: "1:608665539969:web:ad7f89fa83b72447f1c480",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const authPanel = document.getElementById("auth-panel");
const emailInput = document.getElementById("email");
const passInput = document.getElementById("password");
const signupBtn = document.getElementById("signup-btn");
const loginBtn = document.getElementById("login-btn");
const resendBtn = document.getElementById("resend-btn");
const authMsg = document.getElementById("auth-msg");

const appDiv = document.getElementById("app");
const meEmail = document.getElementById("me-email");
const logoutBtn = document.getElementById("logout-btn");

const searchEmail = document.getElementById("search-email");
const searchBtn = document.getElementById("search-btn");
const searchMsg = document.getElementById("search-msg");

const chatArea = document.getElementById("chat-area");
const chatWith = document.getElementById("chat-with");
const roomMessages = document.getElementById("room-messages");
const roomForm = document.getElementById("room-form");
const roomInput = document.getElementById("room-input");

let myUser = null;
let currentRoomId = null;
let childListeners = {};

signupBtn.addEventListener("click", async () => {
  const email = (emailInput.value || "").trim();
  const password = passInput.value || "";
  authMsg.textContent = "";
  if (!email || password.length < 6) {
    authMsg.textContent =
      "Enter email and password must be at least 6 characters long.";
    return;
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user);
    authMsg.textContent =
      "Account created. Verification email sent — check your inbox/spam.";
    await signOut(auth);
  } catch (err) {
    authMsg.textContent = "Signup error: " + err.message;
    console.error(err);
  }
});

loginBtn.addEventListener("click", async () => {
  const email = (emailInput.value || "").trim();
  const password = passInput.value || "";
  authMsg.textContent = "";
  if (!email || password.length < 6) {
    authMsg.textContent = "Enter correct email and password.";
    return;
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!cred.user.emailVerified) {
      authMsg.textContent =
        "Email has not been verified yet. Check your inbox for the verification link.";
      await signOut(auth);
    } else {
      authMsg.textContent = "";
    }
  } catch (err) {
    authMsg.textContent = "Login error: " + err.message;
    console.error(err);
  }
});

resendBtn.addEventListener("click", async () => {
  authMsg.textContent = "";
  try {
    const user = auth.currentUser;
    if (user) {
      await sendEmailVerification(user);
      authMsg.textContent = "Verification email resent. Check spam folder.";
    } else {
      authMsg.textContent =
        "Login first (this will work if you sign in first and then sign out before signup).";
    }
  } catch (err) {
    authMsg.textContent = "Resend error: " + err.message;
    console.error(err);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  location.reload();
});

onAuthStateChanged(auth, async (user) => {
  if (user && user.emailVerified) {
    myUser = { uid: user.uid, email: user.email };
    authPanel.classList.add("hidden");
    appDiv.classList.remove("hidden");
    meEmail.textContent = user.email;

    const userRef = ref(db, "users/" + user.uid);
    await set(userRef, {
      email: user.email,
      online: true,
      lastSeen: serverTimestamp(),
    });
    onDisconnect(ref(db, "users/" + user.uid + "/online")).set(false);
    onDisconnect(ref(db, "users/" + user.uid + "/lastSeen")).set(
      serverTimestamp(),
    );
    await set(ref(db, "users/" + user.uid + "/online"), true);
  } else {
    myUser = null;
    authPanel.classList.remove("hidden");
    appDiv.classList.add("hidden");
    chatArea.classList.add("hidden");
  }
});

searchBtn.addEventListener("click", async () => {
  const target = (searchEmail.value || "").trim().toLowerCase();
  searchMsg.textContent = "";
  chatArea.classList.add("hidden");
  if (!target) {
    searchMsg.textContent = "Write the email first.";
    return;
  }
  if (!myUser) {
    searchMsg.textContent = "Login first.";
    return;
  }
  if (target === myUser.email.toLowerCase()) {
    searchMsg.textContent = "you can't talk with your self";
    return;
  }

  const q = query(ref(db, "users"), orderByChild("email"), equalTo(target));
  try {
    const snap = await get(q);
    if (!snap.exists()) {
      searchMsg.innerHTML = `User nahi mila. <button id="invite-btn">Invite via email</button>`;
      document.getElementById("invite-btn").addEventListener("click", () => {
        const subject = encodeURIComponent("Join my chat app");
        const body = encodeURIComponent(
          `I invited you to chat. App link: <https://chat-app-three-sooty-37.vercel.app/>`,
        );
        window.location.href = `mailto:${target}?subject=${subject}&body=${body}`;
      });
      return;
    }
    const users = snap.val();
    const keys = Object.keys(users);
    const otherUid = keys[0];
    const otherData = users[otherUid];

    if (otherData.online) {
      startOrOpenRoom(otherUid, otherData.email);
    } else {
      searchMsg.innerHTML = `User offline. <button id="invite-btn2">Invite</button> <button id="start-room">Start anyway</button>`;
      document.getElementById("invite-btn2").addEventListener("click", () => {
        const subject = encodeURIComponent("Join my chat app");
        const body = encodeURIComponent(
          `I invited you to chat. Please sign up and provide your email address to chat. App link: <https://chat-app-three-sooty-37.vercel.app/>`,
        );
        window.location.href = `mailto:${target}?subject=${subject}&body=${body}`;
      });
      document.getElementById("start-room").addEventListener("click", () => {
        startOrOpenRoom(otherUid, otherData.email);
      });
    }
  } catch (err) {
    searchMsg.textContent = "Search error: " + err.message;
    console.error(err);
  }
});

function startOrOpenRoom(otherUid, otherEmail) {
  if (!myUser) return;
  const u1 = myUser.uid;
  const u2 = otherUid;
  const roomId = [u1, u2].sort().join("_");
  currentRoomId = roomId;

  chatWith.textContent = "Chat with: " + otherEmail;
  roomMessages.innerHTML = "";
  chatArea.classList.remove("hidden");

  const messagesRef = ref(db, "rooms/" + roomId + "/messages");

  if (childListeners[roomId]) return;
  childListeners[roomId] = true;

  onChildAdded(messagesRef, (snap) => {
    const data = snap.val();
    const el = document.createElement("div");
    el.classList.add("message", data.userUid === myUser.uid ? "self" : "other");
    el.innerHTML = `<strong>${data.userEmail}:</strong> ${data.text}`;
    roomMessages.appendChild(el);
    roomMessages.scrollTop = roomMessages.scrollHeight;
  });
}

roomForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentRoomId || !myUser) return;
  const txt = (roomInput.value || "").trim();
  if (!txt) return;
  const messagesRef = ref(db, "rooms/" + currentRoomId + "/messages");
  push(messagesRef, {
    userUid: myUser.uid,
    userEmail: myUser.email,
    text: txt,
    ts: serverTimestamp(),
  });
  roomInput.value = "";
});
