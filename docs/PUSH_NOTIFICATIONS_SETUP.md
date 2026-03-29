# iOS Push Notifications – Full Setup (Auto-Apply)

Ek baar ye steps complete karne ke baad, EAS credentials save ho jayenge. **Har naye build pe push automatically use hoga** – dubara .p8 path nahi dena padega.

---

## Part 1: Apple Developer Portal – APNs Key (.p8) banana

### Step 1.1: Portal kholo
1. **https://developer.apple.com/account** pe jao.
2. Apple ID se **Sign In** karo (jo account App Store Connect / Team ID ke liye use hota hai).
3. Left side se **Certificates, Identifiers & Profiles** pe jao.

### Step 1.2: Keys section
1. Left menu mein **Keys** pe click karo.
2. **+** (Create a key) button dabao.

### Step 1.3: Key create karo
1. **Key Name:** kuch bhi (e.g. `PrecisionGlobe APNs`).
2. **Apple Push Notifications service (APNs)** checkbox **ON** karo.
3. **Continue** → **Register** dabao.

### Step 1.4: .p8 file download karo
1. **Download** button pe click karo.
2. **.p8** file save ho jayegi (e.g. `AuthKey_XXXXXXXXXX.p8`).
3. **Important:** Ye file sirf ek baar download hoti hai. Isko safe jagah copy karo (e.g. project folder ya secure folder).
4. **Key ID** note karo (page pe dikhega, 10 characters jaisa – e.g. `ABC12DEFGH`). EAS ko baad mein chahiye.

### Step 1.5: Team ID & Bundle ID note karo
- **Team ID:** Developer account → **Membership** ya Keys page pe dikhta hai (10 characters).
- **Bundle ID:** `com.precisionglobe.app` (app.json mein hai).

---

## Part 2: EAS mein credentials set karo (ek baar – phir auto-apply)

Isse EAS servers pe push credentials save ho jayenge. **Har future iOS build automatically isi key use karega.**

### Step 2.1: Project folder se credentials open karo
```bash
cd /Applications/MAMP/htdocs/Precision-Mobileapp/PrecisionApp
npx eas credentials
```

### Step 2.2: Options select karo
1. **Platform:** `iOS` select karo.
2. **Profile:** `production` (ya jo use karte ho).
3. **What do you want to do?** → **Push Notifications: Manage your Apple Push Notifications key** (ya similar option) select karo.

### Step 2.3: .p8 file path do
1. Jab puche **Path to P8 file:**  
   Apni .p8 file ka **full path** do, e.g.  
   `/Users/ronakpatel/Downloads/AuthKey_XXXXXXXXXX.p8`  
   (ya jahan bhi file save ki hai).
2. **Key ID** puche to woh 10-character Key ID daalo jo Part 1.4 mein note kiya tha.
3. **Team ID** aur **Bundle ID** agar puche to:  
   - Team ID: Apple Developer Team ID  
   - Bundle ID: `com.precisionglobe.app`

### Step 2.4: Save confirm
- EAS credentials **remotely save** ho jayenge.
- Next time `eas build --platform ios --profile production` chalane pe **push automatically use hoga**, path dobara nahi puchenga.

---

## Part 3: Build chalao (push ab auto-apply)

```bash
npx eas build --platform ios --profile production
```

- **Would you like to set up Push Notifications?** → **Yes** choose karo.
- **Generate a new Apple Push Notifications service key?** → **No** (kyunki ab credentials pehle set kar chuke ho).
- Agar EAS pehle se credentials pechaan leta hai to seedha build start ho jayega; koi path nahi puchenga.

---

## Part 4: App / Backend side (already done in your project)

- **App:** `expo-notifications` + token backend pe bhejna (Contact Us wale flow se alag – ye pehle se hai).
- **Backend:** `mobile_device_tokens` + Expo Push API (already implemented).
- **App Store Connect:** Submission ke time koi extra push-specific step nahi; normal review process.

---

## Quick checklist

| Step | Kya karna hai | Auto-apply? |
|------|----------------|------------|
| 1 | Apple Developer → Keys → APNs key banao, .p8 download, Key ID note | – |
| 2 | `eas credentials` → iOS → Push Notifications → .p8 path + Key ID do | ✅ Yes – saved on EAS |
| 3 | `eas build --platform ios --profile production` | ✅ Push credentials auto use |
| 4 | Submit to App Store (same as before) | – |

---

## Agar "Path to P8 file" phir bhi puche

- **Reason:** Is project ke liye EAS pe push key pehli baar set nahi hui thi.
- **Fix:** Part 2 dobara karo (`eas credentials` → iOS → Push Notifications → path + Key ID). Uske baad next builds pe ye prompt nahi aana chahiye.

---

## File path examples (replace with your path)

- Mac Downloads: `/Users/ronakpatel/Downloads/AuthKey_XXXXXXXXXX.p8`
- Project folder: `/Applications/MAMP/htdocs/Precision-Mobileapp/PrecisionApp/AuthKey_XXXXXXXXXX.p8`

**Security:** .p8 file ko git mein commit **mat** karo. `.gitignore` mein `*.p8` add karo agar project folder mein rakho.
