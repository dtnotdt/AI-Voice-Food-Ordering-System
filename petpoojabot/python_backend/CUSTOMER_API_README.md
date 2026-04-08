# Customer Login and Order History API Documentation

## Database Schema

### customers table
```sql
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### orders table
```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    total_price DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### order_items table
```sql
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL
);
```

## API Endpoints

### 1. Customer Login
**POST** `/api/login`

Request body:
```json
{
    "phone_number": "+919876543210",
    "name": "John Doe"  // Optional
}
```

Response:
```json
{
    "customer_id": 1,
    "phone_number": "+919876543210",
    "name": "John Doe",
    "is_new_customer": true
}
```

### 2. Order History
**GET** `/api/order-history/{phone_number}`

Response:
```json
{
    "phone_number": "+919876543210",
    "orders": [
        {
            "order_id": 1,
            "order_date": "2026-03-13T10:30:00.000Z",
            "status": "delivered",
            "items": [
                {
                    "item_name": "Paneer Pizza",
                    "quantity": 2,
                    "price": 299.00
                },
                {
                    "item_name": "Cold Coffee",
                    "quantity": 1,
                    "price": 89.00
                }
            ],
            "total_price": 687.00
        },
        {
            "order_id": 2,
            "order_date": "2026-03-12T15:45:00.000Z",
            "status": "confirmed",
            "items": [
                {
                    "item_name": "Veg Burger",
                    "quantity": 1,
                    "price": 149.00
                }
            ],
            "total_price": 149.00
        }
    ]
}
```

### 3. Updated Voice Order Final Confirm
**POST** `/voice/final-confirm`

Updated request body (now includes phone_number):
```json
{
    "cart": [
        {
            "name": "Paneer Pizza",
            "quantity": 2,
            "price": 299.00
        }
    ],
    "address": {
        "display_name": "123 Main Street, Mumbai",
        "area": "Andheri"
    },
    "phone_number": "+919876543210",
    "language": "en-IN"
}
```

Response:
```json
{
    "confirmed": true,
    "order_id": "ORD-000001",
    "customer_id": 1,
    "total": 598.00,
    "delivery_address": {
        "display_name": "123 Main Street, Mumbai",
        "area": "Andheri"
    },
    "reply": "Your order ORD-000001 has been placed successfully! Total: ₹598. We'll deliver to Andheri."
}
```

### 4. Updated POS Sync
**POST** `/pos/sync`

Updated request body (now includes optional phone_number):
```json
{
    "order_type": "delivery",
    "total_amount": 598.00,
    "items": [
        {
            "name": "Paneer Pizza",
            "quantity": 2,
            "price": 299.00
        }
    ],
    "instructions": "Extra cheese",
    "customer_language_pref": "en-IN",
    "phone_number": "+919876543210"
}
```

Response:
```json
{
    "status": "success",
    "ticket": {
        "kitchen_ticket_id": "KOT-ABC123",
        "type": "delivery",
        "items": [...],
        "notes": "Extra cheese",
        "db_order_id": 1
    },
    "db_order_id": 1
}
```

## Error Handling

### Invalid Phone Number
```json
{
    "detail": "Invalid phone number format"
}
```

### Customer Not Found
```json
{
    "detail": "Customer not found"
}
```

### Database Connection Error
```json
{
    "detail": "Database connection failed"
}
```

## Setup Instructions

1. **Install PostgreSQL** and create database:
```bash
createdb petpooja_db
```

2. **Set environment variable**:
```bash
export DATABASE_URL="postgresql://postgres:password@localhost:5432/petpooja_db"
```

3. **Initialize database**:
```bash
cd python_backend
python db_utils.py
```

4. **Run the server**:
```bash
python main.py
```

## Testing with curl

### Test Login:
```bash
curl -X POST "http://localhost:8000/api/login" \
     -H "Content-Type: application/json" \
     -d '{"phone_number": "+919876543210", "name": "John Doe"}'
```

### Test Order History:
```bash
curl -X GET "http://localhost:8000/api/order-history/+919876543210"
```

## Features Implemented

✅ **PostgreSQL database integration**
✅ **Customer login with phone number**
✅ **Automatic customer creation**
✅ **Order history retrieval**
✅ **Order storage with items**
✅ **Updated voice ordering flow**
✅ **Updated POS integration**
✅ **Comprehensive error handling**
✅ **Phone number validation**
✅ **Production-ready code structure**
