const video = document.getElementById('preview');
const productList = document.getElementById('product-list');
const totalAmountDisplay = document.getElementById('total-amount');
const generateBillButton = document.getElementById('generateBillButton');
const customerNumberInput = document.getElementById('customerNumber');
const customerNameInput = document.getElementById('customerName');
const invoiceNumberDisplay = document.getElementById('invoice-number-display');

let stream;
let products = [];
let scannedProducts = [];
let invoiceCounter = 1;

fetch('products.json')
    .then(response => response.json())
    .then(data => {
        products = data;
        startScanning();
    });

function startScanning() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
            stream = s;
            video.srcObject = stream;
            video.play();
            requestAnimationFrame(tick);
        })
        .catch(error => {
            console.error('Camera access error:', error);
        });
}

function tick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const canvasElement = document.createElement('canvas');
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
        const canvas = canvasElement.getContext('2d');
        canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
        const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
        });

        if (code) {
            handleScan(code.data);
            overlayContext.fillStyle = 'rgba(0, 255, 0, 0.5)';
            overlayContext.fillRect(0, 0, overlay.width, overlay.height);
            setTimeout(() => { overlayContext.clearRect(0, 0, overlay.width, overlay.height) }, 500);
        }
    }
    requestAnimationFrame(tick);
}

function handleScan(qrCodeData) {
    const foundProduct = products.find(product => product.qrCode === qrCodeData);
    if (foundProduct) {
        const existingProduct = scannedProducts.find(p => p.qrCode === foundProduct.qrCode);

        if (existingProduct) {
            if (confirm(`Add another ${foundProduct.name}?`)) {
                existingProduct.quantity++;
                updateDisplay();
                beep();
            }
        } else {
            if (confirm(`Add ${foundProduct.name} to the list?`)) {
                scannedProducts.push({ ...foundProduct, quantity: 1 });
                updateDisplay();
                beep();
            }
        }
    } else {
        alert('Product not found!');
    }
}

function updateDisplay() {
    productList.innerHTML = '';
    let total = 0;

    scannedProducts.forEach(product => {
        const listItem = document.createElement('li');
        listItem.classList.add('product-item');
        listItem.innerHTML = `
            <span>${product.name} - ₹${product.price.toFixed(2)} x ${product.quantity}</span>
            <div>
                <button onclick="reduceQuantity('${product.qrCode}')">-</button>
                <button onclick="increaseQuantity('${product.qrCode}')">+</button>
                <button onclick="removeProduct('${product.qrCode}')">Remove</button>
            </div>
        `;
        productList.appendChild(listItem);
        total += product.price * product.quantity;
    });

    totalAmountDisplay.textContent = total.toFixed(2);
}

function reduceQuantity(qrCode) {
    const product = scannedProducts.find(p => p.qrCode === qrCode);
    if (product && product.quantity > 1) {
        product.quantity--;
        updateDisplay();
    }
}
function increaseQuantity(qrCode) {
    const product = scannedProducts.find(p => p.qrCode === qrCode);
    if (product) {
        product.quantity++;
        updateDisplay();
    }
}

function removeProduct(qrCode) {
    scannedProducts = scannedProducts.filter(p => p.qrCode !== qrCode);
    updateDisplay();
}

function beep() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    gain.gain.setValueAtTime(0.5, audioContext.currentTime);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
}

window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});

const overlay = document.createElement('canvas');
overlay.style.position = 'absolute';
overlay.style.top = '0';
overlay.style.left = '0';
overlay.width = video.width;
overlay.height = video.height;
video.parentElement.appendChild(overlay);
const overlayContext = overlay.getContext('2d');

generateBillButton.addEventListener('click', () => {
    const customerNumber = customerNumberInput.value;
    const customerName = customerNameInput.value;
    if (!customerNumber) {
        alert('Please enter a customer WhatsApp number.');
        return;
    }

    const invoiceNumber = generateInvoiceNumber();
    const billMessage = generateBillMessage(customerName, invoiceNumber);
    const whatsappLink = `https://wa.me/+91${customerNumber}?text=${encodeURI(billMessage)}`;
    window.open(whatsappLink, '_blank');

    customerNameInput.value = '';
    customerNumberInput.value = '';
    scannedProducts = [];
    updateDisplay();
    invoiceNumberDisplay.textContent = invoiceNumber;
    invoiceCounter++;
});

function generateInvoiceNumber() {
    const invoiceNumber = `INV-${invoiceCounter.toString().padStart(4, '0')}`;
    return invoiceNumber;
}

function generateBillMessage(customerName, invoiceNumber) {
    let billMessage = 'Bill Details:\n\n';
    if (customerName) {
        billMessage += `Customer Name: ${customerName}\n\n`;
    }
    scannedProducts.forEach(product => {
        billMessage += "Item - Price - Qty\n";
        billMessage += `${product.name} - ₹${product.price.toFixed(2)} x ${product.quantity}\n`;
    });
    billMessage += `\nTotal: ₹${totalAmountDisplay.textContent}`;

    billMessage += `\n\nThank you for shopping with Mistress Of Spices`;
  //billMessage += "\nHappy Lighting :)";
    return billMessage;
}
