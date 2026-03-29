# Push Notifications – Backend Guide (mobile folder API)

Backend ko **Expo Push API** use karke notification bhejni hai. Mobile app Expo use karta hai, isliye tokens `ExponentPushToken[xxxx]` format mein honge.

---

## 1. Device token register API (mobile app call karega)

App login ke baad ye endpoint call karega taaki aap token save kar sako.

- **Delegate:** `POST /mobile/delegate/register-push-token`
- **Sponsor:** `POST /mobile/sponsor/register-push-token`

**Body (JSON):**
```json
{
  "expo_push_token": "ExponentPushToken[xxxxxxxxxxxxxx]",
  "device_platform": "ios"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Push token registered"
}
```

**Controller logic (PHP style):**
- Request se `expo_push_token`, optional `device_platform` lo.
- Auth user se `user_id` aur `user_type` (delegate/sponsor) lo.
- `device_tokens` table mein **INSERT** karo; agar same `(user_id, user_type, expo_push_token)` pehle se hai to **UPDATE** (e.g. `updated_at`) ya ignore.
- Unique key `(user_id, user_type, expo_push_token)` hai, isliye duplicate insert na ho.

---

## 2. Notification kab bhejni hai

| Type | Kab trigger karein | Title / Body example |
|------|--------------------|----------------------|
| **meeting_request** | Jab delegate sponsor ko ya sponsor delegate ko meeting request bhejta hai | "New meeting request", "X has sent you a meeting request" |
| **meeting_acceptance** | Jab meeting request accept/reject hoti hai | "Meeting request accepted", "Your meeting request was accepted by X" |
| **session_reminder** | Session/shuru hone se 15–30 min pehle (cron/scheduler) | "Session starting soon", "Agenda item X starts at 10:00 AM" |
| **exhibition_announcement** | Admin jab exhibition/announcement publish kare | "Exhibition update", "New announcement: ..." |

---

## 3. Expo Push API se notification bhejna

Backend se **HTTP POST** karo:

**URL:** `https://exp.host/--/api/v2/push/send`

**Headers:**
- `Content-Type: application/json`
- `Accept: application/json`

**Body (single notification):**
```json
{
  "to": "ExponentPushToken[xxxxxxxxxxxxxx]",
  "title": "New meeting request",
  "body": "Aaron Gabriel has sent you a meeting request.",
  "sound": "default",
  "priority": "high",
  "channelId": "meeting_requests",
  "data": {
    "type": "meeting_request",
    "meeting_request_id": "123",
    "from_name": "Aaron Gabriel"
  }
}
```

**Important:**
- `to` = value from `device_tokens.expo_push_token`.
- `data` mein **type** zaroor bhejo; app isi se screen open karega:
  - `meeting_request` → Meeting Requests screen
  - `meeting_acceptance` → Meeting Requests screen
  - `session_reminder` → Agenda / session detail (agar `agenda_id` bhejoge)
  - `exhibition_announcement` → Dashboard ya announcements

**Multiple devices (same user):**  
`device_tokens` se us user ke saare tokens fetch karke har token ke liye alag request bhejo (Expo ek request mein ek hi `to` leta hai).

---

## 4. PHP example – token save + Expo send

```php
// Register token (in your DelegateController or SponsorController)
public function registerPushToken(Request $request) {
    $token = $request->input('expo_push_token');
    $platform = $request->input('device_platform', '');
    if (empty($token) || strpos($token, 'ExponentPushToken') !== 0) {
        return response()->json(['success' => false, 'message' => 'Invalid token'], 400);
    }
    $user = auth()->user();
    DeviceToken::updateOrCreate(
        [
            'user_id' => $user->id,
            'user_type' => 'delegate', // or 'sponsor'
            'expo_push_token' => $token,
        ],
        ['device_platform' => $platform, 'updated_at' => now()]
    );
    return response()->json(['success' => true, 'message' => 'Push token registered']);
}

// Send push (helper – call when meeting request sent, accepted, etc.)
public function sendPushToUser($userId, $userType, $title, $body, $data = []) {
    $tokens = DeviceToken::where('user_id', $userId)->where('user_type', $userType)->pluck('expo_push_token');
    foreach ($tokens as $expoToken) {
        $response = Http::withHeaders([
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ])->post('https://exp.host/--/api/v2/push/send', [
            'to' => $expoToken,
            'title' => $title,
            'body' => $body,
            'sound' => 'default',
            'priority' => 'high',
            'data' => array_merge(['type' => 'meeting_request'], $data),
        ]);
        // Optional: log in push_notification_log
    }
}
```

---

## 5. Data payload (app navigation ke liye)

App `data.type` ke hisaab se screen kholta hai. Jitna chaho utna extra bhej sakte ho:

| type | Extra fields (optional) |
|------|-------------------------|
| meeting_request | meeting_request_id, from_name |
| meeting_acceptance | meeting_request_id, from_name, accepted (1/0) |
| session_reminder | agenda_id, session_title, start_time |
| exhibition_announcement | announcement_id, link |
| message | (already used in chat) |

Ye fields `data` object mein bhejni hain; app side par use karke deep link / screen open ki ja sakti hai.
