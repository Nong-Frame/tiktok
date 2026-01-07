// ===================================
// TikTok AI Video Creator - App Logic
// ===================================

// State Management
const AppState = {
    config: {
        geminiFlow: '',
        apiKey: '',
        tiktokToken: ''
    },
    products: [],
    schedules: [],
    currentTab: 'setup',
    currentVideo: null,
    dashboard: {
        isSplitMode: false,
        flowUrl: ''
    }
};

// ===================================
// Utility Functions
// ===================================

// Show Toast Notification
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span>${message}</span>
        </div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Show Loading Overlay
function showLoading() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loadingOverlay';
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(overlay);
}

// Hide Loading Overlay
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.remove();
}

// Load from Local Storage
function loadFromStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error loading from storage:', error);
        return null;
    }
}

// Save to Local Storage
function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Error saving to storage:', error);
        return false;
    }
}

// ===================================
// Gemini Flow API Integration
// ===================================

// Convert image file to base64
async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); // Remove data:image/...;base64, prefix
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Call Gemini Flow API
async function callGeminiFlowAPI(productData) {
    const { geminiFlow, apiKey } = AppState.config;

    if (!geminiFlow || !apiKey) {
        throw new Error('กรุณาตั้งค่า Gemini Flow ID และ API Key ก่อน');
    }

    // Convert images to base64
    const imagePromises = Array.from(productData.images).map(file => fileToBase64(file));
    const base64Images = await Promise.all(imagePromises);

    // Prepare prompt for Gemini Flow
    const prompt = `สร้างสคริปต์วิดิโอรีวิวสินค้า TikTok สำหรับ:

ชื่อสินค้า: ${productData.name}
ราคา: ${productData.price} บาท
รายละเอียด: ${productData.description}
สไตล์: ${productData.style}

กรุณาสร้างสคริปต์วิดิโอที่:
1. เหมาะสำหรับ TikTok (สั้น กระชับ น่าสนใจ)
2. มี Hook ที่ดึงดูดความสนใจในวินาทีแรก
3. เน้นจุดเด่นของสินค้า
4. มี Call-to-Action ชัดเจน
5. ใช้ภาษาที่เป็นกันเอง สนุกสนาน
6. ความยาวประมาณ 30-60 วินาที

รูปแบบ: ให้เป็นสคริปต์แบบ Scene by Scene พร้อมคำบรรยาย`;

    // Call Gemini API (using gemini-2.5-flash - confirmed available)
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // Prepare request body
    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                ...base64Images.map(base64 => ({
                    inline_data: {
                        mime_type: "image/jpeg",
                        data: base64
                    }
                }))
            ]
        }]
    };

    console.log('Calling Gemini API with Flow ID:', geminiFlow);

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API call failed');
    }

    const data = await response.json();

    // Extract generated content
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'ไม่สามารถสร้างเนื้อหาได้';

    return {
        content,
        productData,
        timestamp: new Date().toISOString()
    };
}


// ===================================
// Tab Navigation
// ===================================

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');

            // Update active states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            AppState.currentTab = tabId;
        });
    });
}

// ===================================
// Header Scroll Effect
// ===================================

function initHeader() {
    const header = document.getElementById('header');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// ===================================
// Setup Form Handler
// ===================================

function initSetupForm() {
    const form = document.getElementById('setupForm');

    // Load saved config
    const savedConfig = loadFromStorage('appConfig');
    if (savedConfig) {
        document.getElementById('geminiFlow').value = savedConfig.geminiFlow || '';
        document.getElementById('apiKey').value = savedConfig.apiKey || '';
        document.getElementById('tiktokToken').value = savedConfig.tiktokToken || '';
        AppState.config = savedConfig;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const config = {
            geminiFlow: document.getElementById('geminiFlow').value,
            apiKey: document.getElementById('apiKey').value,
            tiktokToken: document.getElementById('tiktokToken').value
        };

        // Validate
        if (!config.geminiFlow || !config.apiKey) {
            showToast('กรุณากรอก Gemini Flow ID และ API Key', 'error');
            return;
        }

        // Save config
        AppState.config = config;
        saveToStorage('appConfig', config);

        showToast('บันทึกการตั้งค่าเรียบร้อยแล้ว! 🎉', 'success');

        // Switch to creator tab
        setTimeout(() => {
            document.querySelector('[data-tab="creator"]').click();
        }, 1000);
    });
}

// ===================================
// AI Creator Form Handler
// ===================================

function initCreatorForm() {
    const form = document.getElementById('creatorForm');
    const imageInput = document.getElementById('productImage');
    const imagePreview = document.getElementById('imagePreview');
    const videoPreview = document.getElementById('videoPreview');

    // Image Upload Handler
    imageInput.addEventListener('change', (e) => {
        const files = e.target.files;
        imagePreview.innerHTML = '';

        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('div');
                    img.className = 'product-card';
                    img.innerHTML = `
                        <img src="${e.target.result}" alt="Product" class="product-image">
                    `;
                    imagePreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        });

        if (files.length > 0) {
            showToast(`อัปโหลด ${files.length} รูปภาพแล้ว`, 'success');
        }
    });

    // Form Submit Handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Check if API is configured
        if (!AppState.config.apiKey || !AppState.config.geminiFlow) {
            showToast('กรุณาตั้งค่า API ก่อนใช้งาน', 'error');
            document.querySelector('[data-tab="setup"]').click();
            return;
        }

        const productData = {
            name: document.getElementById('productName').value,
            description: document.getElementById('productDescription').value,
            price: document.getElementById('productPrice').value,
            style: document.getElementById('videoStyle').value,
            images: imageInput.files
        };

        // Validate
        if (!productData.name || !productData.description || !productData.price) {
            showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
            return;
        }

        if (productData.images.length === 0) {
            showToast('กรุณาอัปโหลดรูปภาพสินค้า', 'error');
            return;
        }

        // Show loading
        showLoading();

        try {
            // Automatically enable split mode if not active to show Flow side-by-side
            if (!AppState.dashboard.isSplitMode) {
                const toggleBtn = document.getElementById('dashboardToggle');
                if (toggleBtn) toggleBtn.click();
            } else {
                updateFlowIframe();
            }

            // Call Gemini Flow API
            const videoResult = await callGeminiFlowAPI(productData);

            hideLoading();

            // Show video preview
            videoPreview.classList.remove('hidden');
            document.getElementById('videoPlayer').innerHTML = `
                <div style="text-align: center;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">🎬</div>
                    <h3>วิดิโอของคุณพร้อมแล้ว!</h3>
                    <p class="text-secondary">ระบบ AI ได้สร้างวิดิโอรีวิว "${productData.name}" เรียบร้อยแล้ว</p>
                    ${videoResult.content ? `<div style="margin-top: 1rem; padding: 1rem; background: var(--bg-glass); border-radius: var(--radius-md); text-align: left;"><pre style="white-space: pre-wrap; font-size: 0.875rem;">${videoResult.content}</pre></div>` : ''}
                </div>
            `;

            showToast('สร้างวิดิโอสำเร็จ! 🎉', 'success');

            // Scroll to preview
            videoPreview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (error) {
            hideLoading();
            showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
            console.error('Error calling Gemini Flow:', error);
        }
    });
}

// ===================================
// Schedule Form Handler
// ===================================

function initScheduleForm() {
    const form = document.getElementById('scheduleForm');
    const scheduleList = document.getElementById('scheduleList');

    // Load saved schedules
    const savedSchedules = loadFromStorage('schedules');
    if (savedSchedules && savedSchedules.length > 0) {
        AppState.schedules = savedSchedules;
        renderSchedules();
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const scheduleData = {
            id: Date.now(),
            video: document.getElementById('scheduleVideo').value,
            date: document.getElementById('scheduleDate').value,
            time: document.getElementById('scheduleTime').value,
            caption: document.getElementById('postCaption').value,
            status: 'scheduled'
        };

        // Validate
        if (!scheduleData.video || !scheduleData.date || !scheduleData.time) {
            showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
            return;
        }

        // Add to schedules
        AppState.schedules.push(scheduleData);
        saveToStorage('schedules', AppState.schedules);

        // Render
        renderSchedules();

        showToast('ตั้งเวลาโพสต์เรียบร้อยแล้ว! ⏰', 'success');

        // Reset form
        form.reset();
    });

    function renderSchedules() {
        if (AppState.schedules.length === 0) {
            scheduleList.innerHTML = `
                <div class="card card-glass text-center">
                    <p class="text-secondary">ยังไม่มีรายการโพสต์ที่กำหนดไว้</p>
                </div>
            `;
            return;
        }

        scheduleList.innerHTML = AppState.schedules.map(schedule => {
            const dateTime = new Date(`${schedule.date}T${schedule.time}`);
            const formattedDate = dateTime.toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const formattedTime = dateTime.toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="schedule-item">
                    <div class="schedule-info">
                        <h4>${schedule.video === 'video1' ? 'วิดิโอรีวิวสินค้า #1' : 'วิดิโอรีวิวสินค้า #2'}</h4>
                        <p class="schedule-time">📅 ${formattedDate} เวลา ${formattedTime} น.</p>
                        ${schedule.caption ? `<p class="text-secondary" style="font-size: 0.875rem; margin-top: 0.25rem;">${schedule.caption}</p>` : ''}
                    </div>
                    <div class="flex gap-2">
                        <span class="schedule-status status-${schedule.status}">${getStatusText(schedule.status)}</span>
                        <button class="btn btn-ghost" style="padding: 0.5rem 1rem;" onclick="deleteSchedule(${schedule.id})">ลบ</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function getStatusText(status) {
        const statusMap = {
            'pending': 'รอดำเนินการ',
            'scheduled': 'กำหนดเวลาแล้ว',
            'posted': 'โพสต์แล้ว'
        };
        return statusMap[status] || status;
    }

    // Make delete function global
    window.deleteSchedule = function (id) {
        AppState.schedules = AppState.schedules.filter(s => s.id !== id);
        saveToStorage('schedules', AppState.schedules);
        renderSchedules();
        showToast('ลบรายการเรียบร้อยแล้ว', 'success');
    };
}

// ===================================
// Showcase Sync Handler
// ===================================

function initShowcaseForm() {
    const form = document.getElementById('showcaseForm');
    const results = document.getElementById('showcaseResults');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const showcaseId = document.getElementById('showcaseId').value;

        if (!showcaseId) {
            showToast('กรุณากรอก Showcase ID หรือ Product ID', 'error');
            return;
        }

        // Show loading
        showLoading();

        // Simulate API call (replace with actual TikTok API call)
        setTimeout(() => {
            hideLoading();

            // Show results
            results.classList.remove('hidden');
            document.getElementById('syncedProductName').textContent = 'เสื้อยืดคอกลม Premium Quality';
            document.getElementById('syncedProductDesc').textContent = 'เสื้อยืดคุณภาพดี ผ้านุ่ม ใส่สบาย ไม่ร้อน มีหลายสี';
            document.getElementById('syncedProductPrice').textContent = '฿299';

            showToast('ซิงค์ข้อมูลสินค้าสำเร็จ! 🎉', 'success');

            // Scroll to results
            results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 1500);
    });
}

// ===================================
// Product Inventory Handler
// ===================================

function initInventory() {
    const searchInput = document.getElementById('searchProduct');
    const addBtn = document.getElementById('addProductBtn');
    const inventory = document.getElementById('productInventory');

    // Load saved products
    const savedProducts = loadFromStorage('products');
    if (savedProducts && savedProducts.length > 0) {
        AppState.products = savedProducts;
    }

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const productCards = inventory.querySelectorAll('.product-card');

        productCards.forEach(card => {
            const name = card.querySelector('.product-name').textContent.toLowerCase();
            if (name.includes(query)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    });

    // Add product button
    addBtn.addEventListener('click', () => {
        showToast('ฟีเจอร์เพิ่มสินค้าใหม่กำลังพัฒนา...', 'info');
        // In a real app, this would open a modal to add new product
    });
}

// ===================================
// Smooth Scroll for Navigation
// ===================================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// ===================================
// Dashboard Layout Handler
// ===================================

function initDashboard() {
    const toggleBtn = document.getElementById('dashboardToggle');
    const appContainer = document.getElementById('appContainer');
    const appSidebar = document.getElementById('appSidebar');
    const flowIframe = document.getElementById('flowIframe');
    const refreshBtn = document.getElementById('refreshFlow');
    const openExternalBtn = document.getElementById('openExternal');
    const iframePlaceholder = document.getElementById('iframePlaceholder');

    // Load initial state (Default to split mode for login)
    const savedDashboard = loadFromStorage('dashboardState');
    if (!savedDashboard || savedDashboard.isSplitMode !== false) {
        AppState.dashboard.isSplitMode = true;
        appContainer.classList.add('split-mode');
        document.body.classList.add('split-mode-active');
        toggleBtn.classList.add('active');
        // Small delay to ensure Flow ID is loaded from storage first
        setTimeout(updateFlowIframe, 100);
    }

    // Toggle Split Mode
    toggleBtn.addEventListener('click', () => {
        AppState.dashboard.isSplitMode = !AppState.dashboard.isSplitMode;
        appContainer.classList.toggle('split-mode');
        document.body.classList.toggle('split-mode-active');
        toggleBtn.classList.toggle('active');

        if (AppState.dashboard.isSplitMode) {
            updateFlowIframe();
            showToast('เปิดโหมดแบ่งหน้าจอ 🌓', 'info');
        } else {
            showToast('ปิดโหมดแบ่งหน้าจอ 🌒', 'info');
        }

        saveToStorage('dashboardState', AppState.dashboard);
    });

    // Open Pro Workspace
    const openProBtn = document.getElementById('openProBtn');
    if (openProBtn) {
        openProBtn.addEventListener('click', () => {
            openFlowExternal();
            showToast('เปิดห้องทำงาน PRO แล้ว! ล็อกอินเสร็จแล้วกลับมากด Sync นะครับ 🚀', 'success');
        });
    }

    // Sync Session Button
    const syncSessionBtn = document.getElementById('syncSessionBtn');
    if (syncSessionBtn) {
        syncSessionBtn.addEventListener('click', async () => {
            showToast('กำลังเชื่อมต่อห้องทำงาน... 🔄', 'info');
            // Recreate iframe to catch session
            updateFlowIframe(true);
        });
    }
}

function openFlowExternal() {
    const flowId = AppState.config.geminiFlow;
    if (flowId) {
        const url = `https://labs.google/fx/tools/flow/project/${flowId}`;
        window.open(url, '_blank');
    } else {
        showToast('กรุณากรอก Flow ID ก่อน', 'error');
        document.querySelector('[data-tab="setup"]').click();
    }
}

function updateFlowIframe(forceRecreate = false) {
    const container = document.getElementById('iframeContainer');
    const flowId = AppState.config.geminiFlow;

    if (!flowId) {
        container.innerHTML = `<div style="text-align:center; padding: 2rem;"><p>❌ ยังไม่ได้ตั้งค่า Flow ID</p></div>`;
        return;
    }

    const url = `https://labs.google/fx/tools/flow/project/${flowId}?v=${Date.now()}`;

    if (forceRecreate) {
        container.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.id = 'flowIframe';
        iframe.frameBorder = '0';
        iframe.allow = 'clipboard-read; clipboard-write; identity-credentials-get; storage-access; browsing-topics';
        iframe.src = url;
        container.appendChild(iframe);
        showToast('Hard Sync สำเร็จ! กรุณารอหน้าจอโหลดใหม่ครับ ✨', 'success');
    } else {
        const flowIframe = document.getElementById('flowIframe');
        if (flowIframe && flowIframe.src !== url) {
            flowIframe.src = url;
        }
    }
}

// ===================================
// Initialize App
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎬 TikTok AI Video Creator - Initializing...');

    // Initialize all components
    initHeader();
    initTabs();
    initSetupForm();
    initCreatorForm();
    initScheduleForm();
    initShowcaseForm();
    initInventory();
    initSmoothScroll();
    initDashboard();

    // Show welcome message
    setTimeout(() => {
        showToast('ยินดีต้อนรับสู่ TikTok AI Video Creator! 🎉', 'success');
    }, 500);

    console.log('✅ App initialized successfully!');
});

// ===================================
// Save Video Function
// ===================================

window.saveVideo = function (videoData) {
    if (!videoData) {
        // If no data passed, try to get from AppState
        videoData = AppState.currentVideo;
    }

    if (!videoData) {
        showToast('ไม่พบข้อมูลวิดิโอ', 'error');
        return;
    }

    // Create a text file with the video script
    const content = `TikTok Video Script
==================
Product: ${videoData.productName}
Created: ${new Date(videoData.timestamp).toLocaleString('th-TH')}

${videoData.script}

---
Product Details:
- Name: ${videoData.productData.name}
- Price: ${videoData.productData.price} บาท
- Description: ${videoData.productData.description}
- Style: ${videoData.productData.style}
`;

    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiktok-script-${videoData.productName.replace(/[^a-zA-Z0-9ก-๙]/g, '-')}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('บันทึกสคริปต์วิดิโอเรียบร้อยแล้ว! 💾', 'success');
};

// ===================================
// Add CSS for fade out animation
// ===================================

const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100px);
        }
    }
`;
document.head.appendChild(style);
