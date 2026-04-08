import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csvParser from 'csv-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Data Arrays
let menuItems = [];
let orders = [];
let ratings = {};       // Menu item ratings: { itemId: rating (3.0-5.0) }
let adminRatings = {};  // Admin-set overrides — these NEVER get regenerated
let inventoryAlerts = [
    { ingredient: 'Mozzarella Cheese', status: 'Depleting fast', stock: '4.2 kg', type: 'critical' },
    { ingredient: 'Premium Coffee Beans', status: 'Reorder needed', stock: '1.8 kg', type: 'warning' },
    { ingredient: 'Exotic Salad Greens', status: 'Overstocked risk', stock: '15 kg', type: 'info' }
];

fs.createReadStream(path.join(__dirname, 'data', 'menu.csv'))
    .pipe(csvParser())
    .on('data', (row) => {
        menuItems.push({
            ...row,
            id: parseInt(row.id),
            price: parseFloat(row.price),
            cost: parseFloat(row.cost),
            popularity: parseFloat(row.popularity),
            isVeg: row.isVeg === 'true',
            tags: row.tags ? row.tags.split('|') : []
        });
    })
    .on('end', () => {
        console.log('CSV file successfully processed');
        // Generate default ratings ONLY for items that don't already have one.
        // Admin-set ratings always take priority and are never overwritten.
        let generated = 0;
        menuItems.forEach(item => {
            if (adminRatings[item.id] !== undefined) {
                // Admin override exists — use it, do NOT regenerate
                ratings[item.id] = adminRatings[item.id];
            } else if (ratings[item.id] === undefined) {
                // No rating at all — seed a deterministic default
                const seed = (item.id * 2654435761) % 100;  // Knuth hash
                ratings[item.id] = parseFloat((3.0 + (seed / 100) * 2.0).toFixed(1));
                generated++;
            }
            // else: rating already exists from a previous load, keep it
        });
        console.log(`⭐ Ratings: ${generated} generated, ${Object.keys(adminRatings).length} admin-set`);
    });

const categorizeMenu = () => {
    return menuItems.map(item => {
        const margin = item.price - item.cost;
        const isHighMargin = margin > 150;
        const isHighPop = item.popularity > 0.8;

        let category = 'Dog 🐶';
        if (isHighMargin && isHighPop) category = 'Star ⭐';
        else if (!isHighMargin && isHighPop) category = 'Plowhorse 🐎';
        else if (isHighMargin && !isHighPop) category = 'Puzzle 🧩';

        return { ...item, engineCategory: category, margin };
    });
};

app.get('/api/menu', (req, res) => {
    const items = categorizeMenu().map(item => ({
        ...item,
        rating: ratings[item.id] || 4.0  // Attach rating to each item
    }));
    res.json({ items });
});

// ── Ratings API ──────────────────────────────────────────────
// Get all ratings
app.get('/api/ratings', (req, res) => {
    res.json({ ratings });
});

// Admin: Update a single item's rating — persisted across CSV reloads
app.put('/api/admin/ratings/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { rating } = req.body;
    if (!rating || rating < 1.0 || rating > 5.0) {
        return res.status(400).json({ error: 'Rating must be between 1.0 and 5.0' });
    }
    const item = menuItems.find(m => m.id === id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const parsed = parseFloat(parseFloat(rating).toFixed(1));
    ratings[id] = parsed;
    adminRatings[id] = parsed;  // Mark as admin-set so CSV reload won't overwrite
    console.log(`⭐ [Admin] Rating for '${item.name}' set to ${parsed} (protected)`);
    res.json({ id, name: item.name, rating: parsed });
});

// Process internal orders securely
app.post('/api/order', (req, res) => {
    const { items, paymentMethod, paymentStatus, total, delivery } = req.body;

    const orderId = `ORD-${Date.now()}`;
    const newOrder = {
        orderId,
        items,
        total,
        paymentMethod,
        paymentStatus,
        delivery,
        timestamp: new Date().toISOString()
    };

    orders.unshift(newOrder); // Add to beginning
    res.json(newOrder);
});

// Admin Dashboard stats
app.get('/api/dashboard', (req, res) => {
    const itemsCategorized = categorizeMenu();
    const stars = itemsCategorized.filter(i => i.engineCategory === 'Star ⭐').length;
    const dogs = itemsCategorized.filter(i => i.engineCategory === 'Dog 🐶').length;

    let totalRevenue = 12500 + orders.reduce((sum, o) => sum + o.total, 0);

    // Combo metrics simulation
    const combos = menuItems.filter(i => i.category === 'Combos');
    const comboCount = combos.length || 5; // fallback
    const liveComboRevenue = orders.reduce((sum, o) => {
        return sum + o.items.reduce((itemSum, item) => {
            const menuItem = menuItems.find(m => m.id === item.id);
            if (menuItem && menuItem.category === 'Combos') {
                return itemSum + (item.price * item.quantity);
            }
            return itemSum;
        }, 0);
    }, 0);
    const totalComboRevenue = 3500 + liveComboRevenue;

    res.json({
        live: {
            revenue: totalRevenue,
            orders: 45 + orders.length,
            kitchenQueue: orders.length + 8,
            deliveryActive: 3 + orders.filter(o => o.delivery).length,
            comboRevenue: totalComboRevenue,
            comboCount: comboCount
        },
        menuIntel: { stars, dogs },
        insights: [
            { type: 'Pricing', text: 'Increase price of Butter Chicken by 5% (high elasticity)' },
            { type: 'Promo', text: 'Promote Garlic Bread as a combo to increase AOV' },
            { type: 'Menu Optimization', text: 'Consider removing Exotic Salad (low popularity, low margin)' }
        ],
        recentOrders: orders.slice(0, 5),
        inventoryAlerts
    });
});

const levenshtein = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

app.post('/api/ai/intent', async (req, res) => {
    const { text, language } = req.body;

    const getLocalizedReply = (eng, hi, gu) => {
        if (language === 'hi-IN') return hi;
        if (language === 'gu-IN') return gu;
        return eng;
    };

    try {
        console.log(`[V8] Forwarding to Python Cognitive Engine: "${text}" (${language})`);

        const response = await fetch('http://localhost:8000/nlp/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio_blob: "", text: text, language: language })
        });

        const aiResult = await response.json();
        const intent = aiResult.intent;

        // Legacy block removed. Replacing with Python Forwarding Finalizer.
        if (intent.action === 'checkout') {
            return res.json({
                intent: { action: 'checkout' },
                reply: getLocalizedReply("Taking you to checkout to confirm your order.", "ऑर्डर कन्फर्म करने के लिए चेकआउट पर ले जा रहा हूँ।", "ઓર્ડર કન્ફર્મ કરવા માટે ચેકઆઉટ પર લઈ જઈ રહ્યા છીએ.")
            });
        }
        if (intent.action === 'nav_cart') {
            return res.json({
                intent: { action: 'nav_cart' },
                reply: getLocalizedReply("Here is your cart.", "यह आपका कार्ट है।", "આ તમારું કાર્ટ છે.")
            });
        }

        if (intent.category) {
            const items = menuItems.filter(m => m.category === intent.category).slice(0, 3).map(m => m.name).join(', ');
            return res.json({
                intent: { action: 'category_qa', category: intent.category },
                reply: getLocalizedReply(
                    `In ${intent.category}, we have ${items}, and more.`,
                    `${intent.category} में, हम ${items}, और बहुत कुछ देते हैं।`,
                    `${intent.category} માં, અમે ${items}, અને ઘણું બધું આપીએ છીએ.`
                )
            });
        }

        let baseEnglishReply = "I couldn't find that item on the menu.";
        const fullItem = intent.item_id ? menuItems.find(m => m.id === intent.item_id) : null;

        if (fullItem) {
            intent.itemData = fullItem;
            if (intent.action === 'remove') {
                baseEnglishReply = `Removed ${fullItem.name} from your cart.`;
            } else if (intent.action === 'increase') {
                baseEnglishReply = `Increased ${fullItem.name} quantity by ${intent.quantity}.`;
            } else if (intent.action === 'decrease') {
                baseEnglishReply = `Decreased ${fullItem.name} quantity by ${intent.quantity}.`;
            } else if (intent.action === 'add') {
                let instructionSpoken = intent.special_instructions ? ` with note: ${intent.special_instructions}` : '';
                baseEnglishReply = `Added ${intent.quantity} ${fullItem.name} to your cart${instructionSpoken}.`;
            }
        } else {
            intent.action = 'unknown';
        }

        let finalTTS = baseEnglishReply;
        const isFailure = !fullItem;
        
        // Local multilingual TTS — no external call needed, avoids the broken /nlp/translate_output dependency
        if (fullItem && intent.action === 'add') {
            const instrNote = intent.special_instructions ? ` (${intent.special_instructions})` : '';
            const qty = intent.quantity || 1;
            const name = fullItem.name;
            if (language === 'hi-IN') finalTTS = `आपके कार्ट में ${qty} ${name}${instrNote} जोड़ दिए गए हैं।`;
            else if (language === 'gu-IN') finalTTS = `તમારા કાર્ટમાં ${qty} ${name}${instrNote} ઉમેરવામાં આવ્યા છે.`;
            else if (language === 'ta-IN') finalTTS = `உங்கள் கார்ட்டில் ${qty} ${name}${instrNote} சேர்க்கப்பட்டது.`;
            else if (language === 'ml-IN') finalTTS = `${qty} ${name}${instrNote} കാർട്ടിൽ ചേർത്തു.`;
            else if (language === 'mr-IN') finalTTS = `${qty} ${name}${instrNote} तुमच्या कार्टमध्ये जोडले.`;
            else if (language === 'ar-SA') finalTTS = `تمت إضافة ${qty} ${name}${instrNote} إلى سلة التسوق.`;
            else finalTTS = `Added ${qty} ${name}${instrNote} to your cart.`;
        } else if (fullItem && intent.action === 'remove') {
            if (language === 'hi-IN') finalTTS = `आपके कार्ट से ${fullItem.name} हटा दिया गया है।`;
            else if (language === 'gu-IN') finalTTS = `તમારા કાર્ટમાંથી ${fullItem.name} કાઢી નાખવામાં આવ્યું છે.`;
            else if (language === 'ta-IN') finalTTS = `${fullItem.name} கார்ட்டிலிருந்து நீக்கப்பட்டது.`;
            else if (language === 'ml-IN') finalTTS = `${fullItem.name} കാർട്ടിൽ നിന്ന് നീക്കി.`;
            else if (language === 'mr-IN') finalTTS = `${fullItem.name} तुमच्या कार्टमधून काढले.`;
            else if (language === 'ar-SA') finalTTS = `تمت إزالة ${fullItem.name} من سلة التسوق.`;
            else finalTTS = `Removed ${fullItem.name} from your cart.`;
        } else if (isFailure) {
            const itemName = intent.search_query || 'that item';
            if (language === 'hi-IN') finalTTS = `मुझे "${itemName}" मेनू में नहीं मिला। क्या आप फिर से कहेंगे?`;
            else if (language === 'gu-IN') finalTTS = `"${itemName}" મેનુમાં મળ્યો નહીં. ફરી પ્રયાસ કરો.`;
            else if (language === 'ta-IN') finalTTS = `"${itemName}" மெனுவில் இல்லை. மீண்டும் சொல்லுங்கள்.`;
            else if (language === 'ml-IN') finalTTS = `"${itemName}" മെനുവിൽ കണ്ടെത്തിയില്ല. ദയവായി വീണ്ടും പറയൂ.`;
            else if (language === 'mr-IN') finalTTS = `"${itemName}" मेनूमध्ये सापडला नाही. पुन्हा प्रयत्न करा.`;
            else if (language === 'ar-SA') finalTTS = `لم أجد "${itemName}" في القائمة. هل يمكنك المحاولة مرة أخرى؟`;
            else finalTTS = `I couldn't find "${itemName}" on the menu. Could you try saying it differently?`;
        }
        
        // Enhanced server-side logging
        console.log(`[V8 Debug] Transcript: "${text}" | Lang: ${language} | Intent: ${intent.action} | Item: ${fullItem?.name || 'None'} | Failure: ${isFailure}`);

        intent.itemId = intent.item_id;
        res.json({ intent, reply: finalTTS, isFailure });

    } catch (error) {
        console.error("AI Cognitive FastPath Translation Error:", error);
        res.status(500).json({ error: "Cognitive engine fast-path unavailable", fallback: true });
    }
});

app.post('/api/ai/upsell', (req, res) => {
    const { cart } = req.body;
    const cartIds = cart.map(c => c.id);
    const potential = menuItems.filter(m => !cartIds.includes(m.id) && m.popularity > 0.8 && m.price - m.cost > 100);

    if (potential.length > 0) {
        const suggestion = potential.sort((a, b) => (b.price - b.cost) - (a.price - a.cost))[0];
        res.json({ suggestion });
    } else {
        res.json({ suggestion: null });
    }
});

// ── Smart Menu Q&A ──────────────────────────────────────────────────────────
// Answers natural language questions about the menu using live data.
// Handles: "what's the menu", "do you have dosa", "price of misal pav",
//          "show veg items", "what's popular", "breakfast items" etc.
app.post('/api/ai/menu-query', (req, res) => {
    const { text = '', language = 'en-IN' } = req.body;
    const lower = text.toLowerCase().trim();

    if (menuItems.length === 0) {
        return res.json({ type: 'error', reply: 'Menu is currently loading. Please try again in a moment.' });
    }

    // ── 1. Full menu listing ──
    const fullMenuTriggers = ['menu', 'menu batao', 'show menu', 'kya hai', 'what do you have',
        'aaj kya', 'available hai', 'what is there', 'all items', 'full menu',
        'menu dikhao', 'menu kya hai', 'menu list'];
    
    if (fullMenuTriggers.some(t => lower.includes(t))) {
        const byCategory = {};
        menuItems.forEach(item => {
            if (!byCategory[item.category]) byCategory[item.category] = [];
            byCategory[item.category].push(item.name);
        });
        const parts = Object.entries(byCategory).map(([cat, items]) =>
            `**${cat}**: ${items.slice(0, 4).join(', ')}${items.length > 4 ? ` (+${items.length - 4} more)` : ''}`
        );
        const reply = `Here's our menu:\n${parts.join('\n')}`;
        return res.json({ type: 'menu_list', reply, categories: Object.keys(byCategory), rawData: byCategory });
    }

    // ── 2. Price lookup ──
    const priceMatch = lower.match(/price of (.+)|how much is (.+)|(.+) ka price|(.+) kitne ka/);
    if (priceMatch) {
        const query = (priceMatch[1] || priceMatch[2] || priceMatch[3] || priceMatch[4] || '').trim();
        if (query) {
            const found = menuItems.find(m => m.name.toLowerCase().includes(query) || query.includes(m.name.toLowerCase()));
            if (found) {
                const reply = `${found.name} is priced at ₹${found.price}.`;
                return res.json({ type: 'price', reply, item: found });
            }
        }
    }

    // ── 3. Item availability ("do you have X", "X hai?", "X milega?") ──
    const availMatch = lower.match(/(?:do you have|is there|have you got|milega|hai|available)\s+(.+)|(.+)\s+(?:hai|milega|available|hai kya)/);
    if (availMatch) {
        const query = (availMatch[1] || availMatch[2] || '').trim().replace(/\?/g, '');
        if (query && query.length > 1) {
            // Fuzzy search using levenshtein
            let bestMatch = null;
            let bestScore = Infinity;
            menuItems.forEach(item => {
                const dist = levenshtein(item.name.toLowerCase(), query);
                const partialMatch = item.name.toLowerCase().includes(query) || query.includes(item.name.toLowerCase().split(' ')[0]);
                if (partialMatch || dist <= 3) {
                    if (dist < bestScore) { bestScore = dist; bestMatch = item; }
                }
            });
            if (bestMatch) {
                const reply = `Yes! We have **${bestMatch.name}** for ₹${bestMatch.price}. Would you like to add it to your cart?`;
                return res.json({ type: 'availability', reply, item: bestMatch, available: true });
            } else {
                const reply = `Sorry, we don't have "${query}" on our menu right now. Here are some popular items instead: ${menuItems.filter(m => m.popularity > 0.85).slice(0, 3).map(m => m.name).join(', ')}.`;
                return res.json({ type: 'availability', reply, available: false });
            }
        }
    }

    // ── 4. Category-based listing ──
    const categoryKeywords = {
        'Starters': ['starter', 'starters', 'appetizer', 'snacks', 'snack', 'nashta', 'nashtha'],
        'Main Course': ['main', 'main course', 'main dish', 'khana', 'lunch', 'dinner'],
        'Sides': ['side', 'sides', 'side dish', 'extras'],
        'Drinks': ['drink', 'drinks', 'beverage', 'beverages', 'peene', 'cold drink', 'pani', 'juice'],
        'Combos': ['combo', 'combos', 'set', 'meal deal'],
        'Desserts': ['dessert', 'desserts', 'sweet', 'mithai', 'meetha'],
    };
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(k => lower.includes(k))) {
            const items = menuItems.filter(m => m.category === category);
            if (items.length > 0) {
                const list = items.slice(0, 5).map(m => `${m.name} (₹${m.price})`).join(', ');
                const reply = `In **${category}**, we have: ${list}${items.length > 5 ? ` and ${items.length - 5} more.` : '.'}`;
                return res.json({ type: 'category', reply, category, items });
            }
        }
    }

    // ── 5. Veg / Non-veg filter ──
    if (['veg', 'vegetarian', 'veggie', 'veg option', 'veg items'].some(k => lower.includes(k)) && !lower.includes('non')) {
        const vegItems = menuItems.filter(m => m.isVeg).slice(0, 6).map(m => `${m.name} (₹${m.price})`).join(', ');
        return res.json({ type: 'filter', reply: `Our vegetarian options include: ${vegItems}.` });
    }
    if (['non-veg', 'non veg', 'chicken', 'mutton', 'meat', 'nonveg'].some(k => lower.includes(k))) {
        const nonVegItems = menuItems.filter(m => !m.isVeg).slice(0, 6).map(m => `${m.name} (₹${m.price})`).join(', ');
        if (nonVegItems.length === 0) {
            return res.json({ type: 'filter', reply: 'We are a pure vegetarian restaurant! All our items are veg.' });
        }
        return res.json({ type: 'filter', reply: `Our non-vegetarian options include: ${nonVegItems}.` });
    }

    // ── 6. Popular / recommended items ──
    if (['popular', 'best', 'recommend', 'sabse acha', 'bestseller', 'famous', 'special', 'top'].some(k => lower.includes(k))) {
        const popular = [...menuItems].sort((a, b) => b.popularity - a.popularity).slice(0, 5);
        const list = popular.map(m => `${m.name} (₹${m.price})`).join(', ');
        return res.json({ type: 'popular', reply: `Our most popular items are: ${list}. Would you like to add any?`, items: popular });
    }

    // ── 7. Spicy / hot items ──
    if (['spicy', 'hot', 'masaledar', 'tikha', 'teetha', 'teekha'].some(k => lower.includes(k))) {
        const spicyItems = menuItems.filter(m => m.tags && (m.tags.includes('Spicy') || m.tags.includes('Hot'))).slice(0, 5);
        if (spicyItems.length > 0) {
            const list = spicyItems.map(m => `${m.name} (₹${m.price})`).join(', ');
            return res.json({ type: 'filter', reply: `Our spicy items: ${list}. Want one?` });
        }
    }

    // ── 8. Cheap / budget items ──
    if (['cheap', 'budget', 'affordable', 'sasta', 'kam price', 'low price'].some(k => lower.includes(k))) {
        const cheap = [...menuItems].sort((a, b) => a.price - b.price).slice(0, 5);
        const list = cheap.map(m => `${m.name} (₹${m.price})`).join(', ');
        return res.json({ type: 'filter', reply: `Our most affordable items: ${list}.`, items: cheap });
    }

    // ── Fallback ──
    const topItems = [...menuItems].sort((a, b) => b.popularity - a.popularity).slice(0, 4).map(m => m.name).join(', ');
    return res.json({
        type: 'suggestion',
        reply: `I'm not sure what you're asking. Our top items today are: ${topItems}. You can ask me about the menu, prices, or specific items!`
    });
});

// ── Admin Revenue Intelligence & Menu Analytics Engine ─────────────────

app.get('/api/admin/analytics', (req, res) => {
    // 1 & 2. Contribution Margin & Item-level Profitability
    // Calculate total quantity sold per item
    const salesVelocity = {};
    orders.forEach(order => {
        order.items.forEach(item => {
            salesVelocity[item.id] = (salesVelocity[item.id] || 0) + (item.quantity || 1);
        });
    });

    // We add some mock base volume so new servers don't show all 0s
    const mockBaseVolume = (popularity) => Math.floor(popularity * 200);

    const profitability = menuItems.map(item => {
        const margin = item.price - item.cost;
        const qtySold = (salesVelocity[item.id] || 0) + mockBaseVolume(item.popularity);
        const profit = margin * qtySold;
        const revenue = item.price * qtySold;

        return {
            id: item.id,
            name: item.name,
            category: item.category,
            price: item.price,
            cost: item.cost,
            margin,
            marginPercent: ((margin / item.price) * 100).toFixed(1),
            qtySold,
            revenue,
            profit
        };
    });

    // 3. Sales Velocity & Popularity Ranking
    profitability.sort((a, b) => b.qtySold - a.qtySold);
    const topVelocity = profitability.slice(0, 5);
    const bottomVelocity = [...profitability].sort((a, b) => a.qtySold - b.qtySold).slice(0, 5);

    // Normalizing popularity score (0-100)
    const maxQty = profitability[0]?.qtySold || 1;
    profitability.forEach(p => {
        p.popularityScore = ((p.qtySold / maxQty) * 100).toFixed(1);
    });

    // 4 & 5. High-Margin/Under-Promoted AND Low-Margin/High-Volume
    // Sort logic to find percentiles
    const sortedByMargin = [...profitability].sort((a, b) => b.margin - a.margin);
    const topMarginThreshold = sortedByMargin[Math.floor(profitability.length * 0.3)]?.margin || 0;
    const bottomMarginThreshold = sortedByMargin[Math.floor(profitability.length * 0.7)]?.margin || 0;

    const underPromoted = profitability
        .filter(p => p.margin >= topMarginThreshold && p.popularityScore < 40)
        .map(p => ({ ...p, recommendation: "Promote this item more aggressively" }));

    const riskDetection = profitability
        .filter(p => p.margin <= bottomMarginThreshold && p.popularityScore > 60)
        .map(p => ({ ...p, recommendation: "Price adjustment or cost optimization needed" }));

    // 6. Automated Combo Recommendation (Market Basket / Association Rules)
    const pairCounts = {};
    const mockOrders = [ // Mock dataset to guarantee insights on fresh boot
        [1, 5], [1, 6], [1, 5], [2, 7], [2, 5], [3, 8], [3, 5], [14, 5], [14, 7]
    ];
    
    // Process real orders + mock history
    const allCarts = [...orders.map(o => o.items.map(i => i.id)), ...mockOrders];
    
    allCarts.forEach(cart => {
        for (let i = 0; i < cart.length; i++) {
            for (let j = i + 1; j < cart.length; j++) {
                const id1 = cart[i];
                const id2 = cart[j];
                const pairId = [id1, id2].sort().join('-');
                pairCounts[pairId] = (pairCounts[pairId] || 0) + 1;
            }
        }
    });

    const comboRecommendations = Object.entries(pairCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pairId, count]) => {
            const [id1, id2] = pairId.split('-').map(Number);
            const item1 = menuItems.find(m => m.id === id1);
            const item2 = menuItems.find(m => m.id === id2);
            if (!item1 || !item2) return null;
            
            const standardPrice = item1.price + item2.price;
            const suggestedPrice = Math.floor(standardPrice * 0.9); // 10% combo discount
            
            return {
                items: `${item1.name} + ${item2.name}`,
                frequency: count * 15, // Scale up for UI
                standardPrice,
                suggestedBundlePrice: suggestedPrice,
                profitMargin: suggestedPrice - (item1.cost + item2.cost)
            };
        }).filter(Boolean);

    // 7. Smart Upsell Prioritization Logic
    // Rank = (Margin * 0.5) + (Popularity * 0.5)
    // Here we find the most lucrative items to push
    const upsellPriorities = [...profitability]
        .filter(p => p.price < 200) // Usually sides/drinks
        .map(p => ({
            name: p.name,
            score: ((p.margin / 100) * 0.6 + (p.popularityScore / 100) * 0.4).toFixed(2),
            margin: p.margin
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    // 8. Price Optimization Recommendations
    const priceOptimization = profitability.map(p => {
        let action = "Keep price same";
        let reasoning = "Balanced margin and sales velocity.";
        
        if (p.margin <= bottomMarginThreshold && p.popularityScore > 70) {
            action = "Increase price";
            reasoning = "High sales elasticity allows margin recovery.";
        } else if (p.margin >= topMarginThreshold && p.popularityScore < 30) {
            action = "Decrease price (Promo)";
            reasoning = "Lower price slightly to boost low sales volume.";
        } else if (p.popularityScore > 90) {
            action = "Increase price slightly";
            reasoning = "Extreme popularity supports a 5% price bump.";
        }

        return { name: p.name, currentPrice: p.price, action, reasoning };
    }).filter(p => p.action !== "Keep price same").slice(0, 6);

    // 9. Inventory Signals mapping
    const inventorySignals = inventoryAlerts.map(alert => {
        // Find if this maps to a popular item
        let impact = "Moderate";
        if (alert.type === 'critical') impact = "High - Stock out risk for key items";
        return {
            ...alert,
            impact
        };
    });

    res.json({
        profitability,
        topVelocity,
        bottomVelocity,
        underPromoted,
        riskDetection,
        comboRecommendations,
        upsellPriorities,
        priceOptimization,
        inventorySignals,
        overview: {
            totalMenuProfit: profitability.reduce((sum, p) => sum + p.profit, 0),
            totalMenuRevenue: profitability.reduce((sum, p) => sum + p.revenue, 0),
            avgMarginPercent: (profitability.reduce((sum, p) => sum + parseFloat(p.marginPercent), 0) / profitability.length).toFixed(1)
        }
    });
});

// ── Voice Ordering Flow Proxy Routes ─────────────────────────────────────

app.post('/api/voice/confirm', async (req, res) => {
    try {
        const response = await fetch('http://localhost:8000/voice/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[VoiceFlow] Confirm proxy error:', error.message);
        res.status(500).json({ error: 'Voice confirm service unavailable' });
    }
});

app.post('/api/voice/upsell-response', async (req, res) => {
    try {
        const response = await fetch('http://localhost:8000/voice/upsell-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();

        // If upsell accepted with an item, resolve full menu data
        if (data.item && data.item.id) {
            const fullItem = menuItems.find(m => m.id === parseInt(data.item.id));
            if (fullItem) data.item = fullItem;
        }

        res.json(data);
    } catch (error) {
        console.error('[VoiceFlow] Upsell response proxy error:', error.message);
        res.status(500).json({ error: 'Upsell response service unavailable' });
    }
});

app.post('/api/voice/address', async (req, res) => {
    try {
        const response = await fetch('http://localhost:8000/voice/address', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('[VoiceFlow] Address proxy error:', error.message);
        res.status(500).json({ error: 'Address service unavailable' });
    }
});

app.post('/api/voice/final-confirm', async (req, res) => {
    try {
        // Also create the order locally
        const { cart, address } = req.body;
        const total = cart.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0);
        
        const orderId = `ORD-${Date.now()}`;
        const newOrder = {
            orderId,
            items: cart,
            total,
            paymentMethod: 'voice',
            paymentStatus: 'confirmed',
            delivery: address,
            timestamp: new Date().toISOString()
        };
        orders.unshift(newOrder);

        // Also forward to Python for logging
        const response = await fetch('http://localhost:8000/voice/final-confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        
        res.json({ ...data, order_id: orderId, order: newOrder });
    } catch (error) {
        console.error('[VoiceFlow] Final confirm proxy error:', error.message);
        res.status(500).json({ error: 'Final confirm service unavailable' });
    }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`[V8 Node] PetpoojaBot Interface API running on http://localhost:${PORT}`));
