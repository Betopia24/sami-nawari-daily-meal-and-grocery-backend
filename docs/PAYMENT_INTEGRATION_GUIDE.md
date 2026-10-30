# 💳 Online Payment API & Integration Flow Guide

এই ডকুমেন্টটি Frontend/App Developer-দের জন্য। কোনো ফ্রেমওয়ার্ক-নির্দিষ্ট কোড ছাড়া শুধুমাত্র **API এন্ডপয়েন্ট, রিকোয়েস্ট/রেসপন্স বডি এবং সম্পূর্ণ পেমেন্ট লাইফসাইকেল ফ্লো** এখানে দেওয়া হলো।

---

## 🔄 সম্পূর্ণ পেমেন্ট লাইফসাইকেল ফ্লো (Payment Lifecycle Flow)

```
[Customer / Client App]                        [Backend Server]                         [Stripe]
          │                                           │                                     │
          │ ── 1. POST /api/v1/orders ──────────────► │                                     │
          │    (paymentMethod: "ONLINE")              │                                     │
          │                                           │ ── Creates Pending Order            │
          │ ◄─ Returns { id: orderId } ────────────── │                                     │
          │                                           │                                     │
          │ ── 2. POST /api/v1/payments/create-checkout-session (orderId) ────────────────► │
          │                                           │                                     │
          │                                           │ ── Creates Stripe Session ────────► │
          │                                           │ ◄─ Returns Checkout URL ─────────── │
          │ ◄─ Returns { url: "https://checkout..." } │                                     │
          │                                                                                 │
          │ ── 3. Open Checkout URL in In-App Browser/WebView ────────────────────────────► │
          │                                                                                 │
          │ ◄──────────────── User enters Card & Clicks Pay ─────────────────────────────── │
          │                                                                                 │
          ├─── [CASE A: Success] ───────────────────────────────────────────────────────────►
          │    Redirects to: /api/v1/payments/success?session_id=...
          │    Webhook triggers ──► Backend updates order to "PAID"
          │
          └─── [CASE B: Failed / Cancelled] ────────────────────────────────────────────────►
               Redirects to: /api/v1/payments/cancel
               Client calls: POST /api/v1/payments/retry-payment/:orderId
               Backend returns a new Stripe checkout URL
```

---

## 📡 API এন্ডপয়েন্ট ও ডাটা ফরম্যাট

---

### ১. অর্ডার তৈরি করা (Create Order)
কাস্টমার চেকআউট করার সময় `paymentMethod` হিসেবে `"ONLINE"` পাঠাবে।

* **Method:** `POST`
* **Endpoint:** `{{baseUrl}}/orders`
* **Headers:**
  ```http
  Authorization: Bearer <user-jwt-token>
  Content-Type: application/json
  ```
* **Request Body:**
  ```json
  {
    "deliveryAddress": {
      "streetAddress": "House 12, Road 4",
      "apt": "Flat 3B",
      "city": "Dhaka",
      "state": "Dhaka",
      "postalCode": "1212",
      "country": "Bangladesh"
    },
    "recipientName": "Hassan Mahmud",
    "contactPhone": "01700000000",
    "note": "Call before delivery",
    "paymentMethod": "ONLINE"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "statusCode": 201,
    "success": true,
    "message": "Order placed successfully",
    "data": {
      "id": "6ae4664c6d93dd33a8931649",
      "orderNumber": "ORD-20261030-00005",
      "totalPrice": 24.50,
      "status": "PENDING_PAYMENT",
      "paymentStatus": "PENDING",
      "paymentMethod": "ONLINE"
    }
  }
  ```
> 📌 **সংরক্ষণ করুন:** রেসপন্স থেকে `data.id` (অর্থাৎ `orderId`)-টি নিয়ে পরবর্তী ধাপে ব্যবহার করতে হবে।

---

### ২. স্ট্রাইপ পেমেন্ট সেশন URL নেওয়া (Create Checkout Session)
অর্ডার আইডি পাঠিয়ে স্ট্রাইপের সিকিউর পেমেন্ট পেজ লিংক জেনারেট করুন।

* **Method:** `POST`
* **Endpoint:** `{{baseUrl}}/payments/create-checkout-session`
* **Headers:**
  ```http
  Authorization: Bearer <user-jwt-token>
  Content-Type: application/json
  ```
* **Request Body:**
  ```json
  {
    "orderId": "6ae4664c6d93dd33a8931649"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "statusCode": 200,
    "success": true,
    "message": "Stripe Checkout session created successfully",
    "data": {
      "url": "https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4...",
      "sessionId": "cs_test_a1b2c3d4..."
    }
  }
  ```
> 📌 **ক্লায়েন্টের কাজ:** প্রাপ্ত `data.url`-টি অ্যাপের ইন-অ্যাপ ব্রাউজার বা WebView-তে ওপেন করতে হবে।

---

### ৩. পেমেন্ট রিডাইরেক্ট ও ইভেন্ট হ্যান্ডলিং (URL Callbacks)

ইউজার পেমেন্ট পেজে কার্ড ইনফো দিয়ে সাবমিট করলে স্ট্রাইপ স্বয়ংক্রিয়ভাবে নিচের ব্যাকএন্ড URL-এ রিডাইরেক্ট করবে:

| ইভেন্ট | রিডাইরেক্ট URL পাথ | ক্লায়েন্ট অ্যাপের করণীয় |
| :--- | :--- | :--- |
| **সফল হলে** | `/api/v1/payments/success?session_id=...` | ইন-অ্যাপ ব্রাউজার বন্ধ করে অ্যাপের অর্ডার কনফার্মেশন স্ক্রিনে নিয়ে যান। |
| **ক্যানসেল / ফেইল হলে** | `/api/v1/payments/cancel` | ব্রাউজার বন্ধ করে অর্ডার স্ক্রিনে **"Retry Payment"** বাটন দেখান। |

> ℹ️ ব্যাকএন্ড স্ট্রাইপ ওয়েব হুক (Webhook) থেকে স্বয়ংক্রিয়ভাবে কনফার্মেশন রিসিভ করে অর্ডারের `paymentStatus` আপডেট করে `"PAID"` করে ফেলে।

---

### ৪. পেমেন্ট ফেইল হলে পুনরায় পেমেন্ট (Retry Payment)
যদি ইউজার কার্ড পেমেন্ট ক্যানসেল করে বা ট্রানজ্যাকশন ফেইল হয়, তবে নতুন করে অর্ডার তৈরি না করে এই API কল করে ওই অর্ডারের জন্যই নতুন পেমেন্ট লিংক পাওয়া যাবে।

* **Method:** `POST`
* **Endpoint:** `{{baseUrl}}/payments/retry-payment/:orderId`
* **Headers:**
  ```http
  Authorization: Bearer <user-jwt-token>
  ```
* **URL Parameter:**
  * `:orderId` = অর্ডারের আইডি (যেমন: `6ae4664c6d93dd33a8931649`)
* **Response (200 OK):**
  ```json
  {
    "statusCode": 200,
    "success": true,
    "message": "Payment retry checkout session generated successfully",
    "data": {
      "url": "https://checkout.stripe.com/c/pay/cs_test_retry_xyz...",
      "sessionId": "cs_test_retry_xyz..."
    }
  }
  ```
> 📌 ক্লায়েন্ট অ্যাপ নতুন `url`-টি পুনরায় ইন-অ্যাপ ব্রাউজারে ওপেন করে দেবে।

---

## 🧪 স্ট্রাইপ টেস্ট কার্ড (Stripe Test Credentials)

টেস্টিংয়ের সময় নিচের কার্ড নম্বর ব্যবহার করুন:

* **Card Number:** `4242 4242 4242 4242`
* **Expires:** ভবিষ্যতের যেকোনো মাস/বছর (যেমন: `12/28`)
* **CVC:** যেকোনো ৩ ডিজিট (যেমন: `123`)
* **Postal Code:** যেকোনো কোড (যেমন: `1212` বা `10001`)
