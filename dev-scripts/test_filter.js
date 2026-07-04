// test_filter.js
const { isAdultProduct } = require('./test_filter_helper.js');

const products = [
  { name: 'Kids Educational Toy', category: 'Toys', description: 'Fun for kids' },
  { name: 'Adult Vibrator', category: 'Health', description: 'Personal massager' },
  { name: 'Durex Condom', category: 'Pharmacy', description: 'Pack of 3' },
  { name: 'Laptop', category: 'Electronics', description: '16GB RAM' },
  { name: 'Erotic Lingerie Set', category: 'Fashion', description: 'Lace design' },
];

let foundAdult = 0;
for (const p of products) {
  const isAdult = isAdultProduct(p);
  console.log(`Product: ${p.name} | isAdult: ${isAdult}`);
  if (isAdult) foundAdult++;
}

console.log(`\nFiltered out ${foundAdult} adult products successfully.`);
