# 🌐 CF Subdomain Creator

Aplikasi web sederhana untuk membuat DNS A record subdomain secara otomatis menggunakan **Cloudflare API v4**.

## ✨ Fitur

- 🚀 **Instant Subdomain Creation** - Buat subdomain dalam hitungan detik
- 🔒 **Secure Token Handling** - Token hanya dikirim ke proxy server Anda, tidak disimpan
- ☁️ **Cloudflare Proxied** - Support untuk proxied (orange cloud) dan DNS only (gray cloud)
- 🌍 **Multi-Language** - Support Bahasa Indonesia dan English
- 📱 **Responsive Design** - Bekerja sempurna di desktop dan mobile
- ✅ **Form Validation** - Validasi input real-time sebelum request

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js Serverless Function (Vercel)
- **API**: Cloudflare API v4
- **Deployment**: Vercel

## 📋 Prerequisites

Sebelum menggunakan aplikasi ini, Anda memerlukan:

1. **Cloudflare Account** - https://dash.cloudflare.com
2. **Domain yang sudah di-setup di Cloudflare**
3. **Cloudflare API Token** dengan permissions:
   - `Zone:Read` - untuk membaca informasi zone
   - `DNS:Edit` - untuk membuat DNS record

### Cara Mendapatkan API Token

1. Login ke Cloudflare Dashboard
2. Go to **Account Home** → **API Tokens**
3. Klik **Create Token**
4. Pilih template **Edit zone DNS**
5. Configure permissions:
   - Permissions: `DNS:Edit`, `Zone:Read`
   - Zone Resources: Specific zone (pilih domain Anda)
6. Copy token dan gunakan di aplikasi

## 🚀 Cara Menggunakan

### 1. Input Data
- **Zone ID**: ID zone Cloudflare domain Anda (bisa ditemukan di overview page)
- **API Token**: Token API Cloudflare dengan permission DNS:Edit
- **Subdomain**: Nama subdomain yang ingin dibuat (contoh: `api`, `app`, `v2`)
- **Target IP**: IP address server tujuan (contoh: `192.168.1.1`)
- **Proxied**: Toggle untuk menggunakan Cloudflare proxy (orange cloud) atau DNS only (gray cloud)

### 2. Klik "Create Subdomain"

Aplikasi akan:
1. ✓ Validate semua input
2. ✓ Get domain name dari Zone ID
3. ✓ Create DNS A record di Cloudflare
4. ✓ Return hasil dengan detail record

### 3. Lihat Hasil
Success response berisi:
- Nama subdomain yang dibuat
- Type record (A)
- IP target
- Status proxied
- TTL
- Record ID

## 📁 Struktur Project

```
subdo-create/
├── index.html          # Frontend aplikasi
├── api/
│   └── proxy.js        # Serverless function untuk API proxy
├── vercel.json         # Konfigurasi Vercel
└── README.md           # File ini
```

## 🔐 Keamanan

- **Token tidak disimpan** - Token hanya digunakan untuk request dan tidak pernah disimpan di server
- **CORS protected** - API hanya menerima request dari domain Anda
- **Server-side proxy** - Request ke Cloudflare diproses di backend, bukan dari browser
- **Form validation** - Semua input divalidasi sebelum request

## ⚙️ Deployment

Project ini sudah siap di-deploy ke **Vercel** dengan konfigurasi yang tepat.

### Langkah Deploy:

1. Fork atau clone repository ini
2. Connect ke Vercel
3. Vercel akan otomatis detect `vercel.json`
4. Deploy! 🚀

## 🔧 API Endpoint

### POST `/api/proxy.js`

**Request Body:**
```javascript
{
  "zone": "765d7de87d3985845c82ac187e8c108c",  // Cloudflare Zone ID
  "token": "YOUR_API_TOKEN",                    // Cloudflare API Token
  "subdomain": "test",                          // Subdomain name
  "ip": "192.168.1.1",                          // Target IP
  "proxied": true                               // Proxied atau DNS only
}
```

**Success Response (200):**
```javascript
{
  "success": true,
  "result": {
    "id": "372e67954025e0ba6aaa6d586b9e0b59",
    "type": "A",
    "name": "test.example.com",
    "content": "192.168.1.1",
    "proxied": true,
    "ttl": 120
  }
}
```

**Error Response:**
```javascript
{
  "success": false,
  "errors": [
    {
      "code": 9003,
      "message": "Invalid target for a proxied record"
    }
  ]
}
```

## 🐛 Troubleshooting

### Error: "Zone ID tidak valid atau Token salah"
- Pastikan Zone ID sudah benar (copy dari Cloudflare dashboard)
- Pastikan API Token masih valid dan memiliki permission `Zone:Read`

### Error: "Target IP is not allowed for a proxied record"
- IP yang Anda gunakan tidak valid untuk proxied record
- Gunakan IP public yang valid
- Atau gunakan mode DNS only (uncheck Proxied)

### Error: "Subdomain already exists"
- Subdomain sudah dibuat sebelumnya
- Gunakan nama subdomain yang berbeda

## 📝 Catatan

- Setiap subdomain yang dibuat akan langsung aktif di Cloudflare
- TTL default adalah 120 detik
- Anda bisa manage/edit record di Cloudflare dashboard kemudian

## 📄 License

Bebas digunakan untuk keperluan pribadi atau komersial.

## 👨‍💻 Author

Dibuat dengan ❤️ untuk kemudahan manage subdomain via Cloudflare API

---

**Butuh bantuan?** Check Cloudflare API documentation: https://developers.cloudflare.com/api/
