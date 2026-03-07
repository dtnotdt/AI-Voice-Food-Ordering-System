import fs from 'fs';

const categories = ['Starters', 'Main Course', 'Beverages', 'Desserts'];
const tags = ['Spicy', 'Sweet', 'Cold', 'Cheesy', 'Hot', 'Vegan'];

// Hardcoded explicit items requested by user to guarantee voice mapping
const explicitItems = [
  { name: 'Veg Burger', category: 'Starters', price: 120, cost: 60, isVeg: true },
  { name: 'Paneer Pizza', category: 'Main Course', price: 250, cost: 120, isVeg: true },
  { name: 'Peri Peri Fries', category: 'Starters', price: 90, cost: 30, isVeg: true },
  { name: 'Fries', category: 'Sides', price: 80, cost: 25, isVeg: true },
  { name: 'Coke', category: 'Beverages', price: 60, cost: 20, isVeg: true },
  { name: 'Garlic Bread', category: 'Starters', price: 110, cost: 40, isVeg: true },
  { name: 'Pepsi', category: 'Beverages', price: 60, cost: 20, isVeg: true },
  { name: 'Cold Coffee', category: 'Beverages', price: 120, cost: 40, isVeg: true },
  { name: 'Veg Wrap', category: 'Starters', price: 100, cost: 40, isVeg: true },
  { name: 'Iced Tea', category: 'Beverages', price: 90, cost: 30, isVeg: true },

  // The Specific Combos
  { name: 'Combo 1: Veg Burger + Fries + Coke', category: 'Combos', price: 199, cost: 105, isVeg: true },
  { name: 'Combo 2: Paneer Pizza + Garlic Bread + Pepsi', category: 'Combos', price: 299, cost: 180, isVeg: true },
  { name: 'Combo 3: Peri Peri Fries + Cold Coffee', category: 'Combos', price: 149, cost: 70, isVeg: true },
  { name: 'Combo 4: Veg Wrap + Iced Tea', category: 'Combos', price: 159, cost: 70, isVeg: true },
  { name: 'Combo 5: 2 Veg Burgers + 1 Large Fries + Coke', category: 'Combos', price: 349, cost: 165, isVeg: true },
];

let data = "id,name,category,price,cost,popularity,tags,isVeg\n";
let currentId = 1;

for (const item of explicitItems) {
  const pop = (Math.random() * 0.4 + 0.5).toFixed(2);
  const itemTags = [tags[Math.floor(Math.random() * tags.length)]].join('|');
  data += `${currentId},${item.name},${item.category},${item.price},${item.cost},${pop},${itemTags},${item.isVeg}\n`;
  currentId++;
}

// Fill up to 150
while (currentId <= 150) {
  const cat = categories[Math.floor(Math.random() * categories.length)];
  const isVeg = Math.random() > 0.4;
  const cost = Math.floor(Math.random() * 100) + 30;
  const price = cost + Math.floor(Math.random() * 200) + 20;
  const pop = (Math.random() * 0.8 + 0.1).toFixed(2);
  const itemTags = [tags[Math.floor(Math.random() * tags.length)]].join('|');
  data += `${currentId},Item ${currentId} ${cat},${cat},${price},${cost},${pop},${itemTags},${isVeg}\n`;
  currentId++;
}

fs.writeFileSync('backend/data/menu.csv', data);
console.log('Regenerated menu.csv with 150 items including Combos.');
