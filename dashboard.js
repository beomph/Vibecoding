// H2GO 대시보드 - 수소거래 플랫폼

// ========== 데이터 구조 ==========
const TRAILER_CAPACITY_KG = 400; // 트레일러 1대당 kg (기본)
const PRODUCTION_SITE = { name: '인천 수소생산공장', address: '인천시 남동구 논현고잔로 123', lat: 37.4489, lng: 126.7317 };
const DEMAND_SITES = [
    { id: 'site1', name: '서울 강남 충전소', address: '서울시 강남구 테헤란로 123', travelTime: 60, lat: 37.5012, lng: 127.0396 },
    { id: 'site2', name: '인천 공항 물류센터', address: '인천시 중구 공항로 272', travelTime: 40, lat: 37.4602, lng: 126.4407 },
    { id: 'site3', name: '수원 산업단지', address: '경기도 수원시 영통구 광교중앙로 120', travelTime: 50, lat: 37.2839, lng: 127.0446 },
    { id: 'site4', name: '안산 수소충전소', address: '경기도 안산시 단원구 중앙대로 123', travelTime: 75, lat: 37.3219, lng: 126.8309 },
    { id: 'site5', name: '부천 물류기지', address: '경기도 부천시 원미구 중동로 100', travelTime: 55, lat: 37.5034, lng: 126.7660 }
];

// 주소별 운송시간 (분)
function getTravelTimeFromAddress(addr) {
    const keywords = [{ key: '강남', time: 60 }, { key: '인천', time: 40 }, { key: '수원', time: 50 }, { key: '안산', time: 75 }, { key: '부천', time: 55 }];
    const found = keywords.find(k => addr && addr.includes(k.key));
    return found ? found.time : 60;
}

// 주소별 좌표 (지도용)
function getCoordinatesFromAddress(addr) {
    const keywords = [
        { key: '강남', lat: 37.5012, lng: 127.0396 },
        { key: '인천', lat: 37.4602, lng: 126.4407 },
        { key: '수원', lat: 37.2839, lng: 127.0446 },
        { key: '안산', lat: 37.3219, lng: 126.8309 },
        { key: '부천', lat: 37.5034, lng: 126.7660 }
    ];
    const found = keywords.find(k => addr && addr.includes(k.key));
    return found ? { lat: found.lat, lng: found.lng } : { lat: 37.5, lng: 127.0 };
}

let orders = JSON.parse(localStorage.getItem('h2go_orders') || '[]');
let currentUser = { type: 'consumer', name: '수요자 A' };
let pendingApprovalOrderId = null;

// ========== 30분 단위 시각 옵션 생성 ==========
function buildTimeOptions() {
    const options = [];
    for (let h = 0; h < 24; h++) {
        options.push(`${h.toString().padStart(2, '0')}:00`);
        options.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return options;
}

const TIME_OPTIONS = buildTimeOptions();

// ========== 유틸리티 ==========
function generateOrderId() {
    return 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
}

function getTodayParts() {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function getConsumerOrders(consumerName) {
    return orders.filter(o => o.consumerName === consumerName);
}

function getAllOrders() {
    return orders
        .filter(o => o.status !== 'cancelled')
        .sort((a, b) => {
            const da = `${a.year}-${String(a.month).padStart(2, '0')}-${String(a.day).padStart(2, '0')} ${a.time}`;
            const db = `${b.year}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')} ${b.time}`;
            return da.localeCompare(db);
        });
}

function formatOrderDateTime(order) {
    return `${order.year}/${order.month}/${order.day} ${order.time}`;
}

function formatOrderDate(order) {
    return `${order.year}/${order.month}/${order.day}`;
}

// 주문 수량 계산 (트레일러 대수 * 용량)
function getOrderQuantity(order) {
    return (order.tubeTrailers || 0) * TRAILER_CAPACITY_KG;
}

// ========== AI 운송계획 ==========
function calculateTransportPlan() {
    const activeStatuses = ['received', 'reviewing', 'confirmed'];
    const activeOrders = getAllOrders().filter(o => activeStatuses.includes(normalizeStatus(o.status)));
    if (activeOrders.length === 0) return null;

    const drivers = parseInt(document.getElementById('availableDrivers')?.value || 5);
    const trailers = parseInt(document.getElementById('availableTrailers')?.value || 3);
    const trailerCapacity = parseInt(document.getElementById('trailerCapacity')?.value || 400);

    const ordersByAddress = {};
    activeOrders.forEach(order => {
        const key = order.address;
        const qty = (order.tubeTrailers || 0) * trailerCapacity;
        if (!ordersByAddress[key]) {
            ordersByAddress[key] = { address: order.address, quantity: 0, tubeTrailers: 0, orders: [], deliveryDate: formatOrderDate(order), time: order.time };
        }
        ordersByAddress[key].quantity += qty;
        ordersByAddress[key].tubeTrailers += (order.tubeTrailers || 0);
        ordersByAddress[key].orders.push(order);
    });

    const destinations = Object.values(ordersByAddress);
    const totalQuantity = destinations.reduce((sum, d) => sum + d.quantity, 0);
    const totalTrailers = destinations.reduce((sum, d) => sum + d.tubeTrailers, 0);

    const getTravelTime = getTravelTimeFromAddress;

    const trailersNeeded = totalTrailers;
    const trailersToUse = Math.min(trailersNeeded, trailers);
    const totalTrips = destinations.length;
    const totalDriveTime = destinations.reduce((sum, d) => sum + getTravelTime(d.address) * 2, 0);
    const hoursPerTrip = 2.5;
    const maxTripsPerDriver = Math.floor(8 / hoursPerTrip);
    const driversNeeded = Math.ceil(totalTrips / maxTripsPerDriver);
    const driversToUse = Math.min(driversNeeded, drivers);

    const schedule = [];
    let currentTime = 8;
    destinations.forEach((dest, i) => {
        const driverNum = (i % driversToUse) + 1;
        schedule.push({
            time: `${Math.floor(currentTime)}:${((currentTime % 1) * 60).toString().padStart(2, '0')}`,
            route: `생산지 → ${dest.address.substring(0, 20)}...`,
            quantity: dest.tubeTrailers + '대 (' + dest.quantity + ' kg)',
            trailer: `트레일러 ${Math.min(dest.tubeTrailers, trailersToUse)}대`,
            driver: `기사 ${driverNum}`,
            duration: getTravelTime(dest.address)
        });
        currentTime += hoursPerTrip;
    });

    return {
        totalQuantity,
        totalTrailers,
        trailersNeeded,
        trailersToUse,
        trailersAvailable: trailers,
        driversNeeded,
        driversToUse,
        driversAvailable: drivers,
        totalTrips,
        totalDriveTime,
        schedule,
        destinations,
        hasShortage: trailersNeeded > trailers || driversNeeded > drivers
    };
}

// ========== 뷰 렌더링 ==========
function showView(viewId) {
    document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId + 'View').classList.add('active');
}

// 주문 상태: 접수(최초), 검토 중, 확정, 보류, 변경 요청
const ORDER_STATUSES = [
    { value: 'received', label: '접수(최초)' },
    { value: 'reviewing', label: '검토 중' },
    { value: 'confirmed', label: '확정' },
    { value: 'on_hold', label: '보류' },
    { value: 'change_requested', label: '변경 요청' }
];

function getStatusLabel(status) {
    const s = ORDER_STATUSES.find(o => o.value === status);
    if (s) return s.label;
    // 레거시 매핑
    const legacy = { pending: '검토 중', confirmed: '확정', change_requested_consumer: '변경 요청', change_requested_supplier: '변경 요청' };
    return legacy[status] || status;
}

function normalizeStatus(status) {
    if (status === 'pending') return 'reviewing';
    if (status === 'change_requested_consumer' || status === 'change_requested_supplier') return 'change_requested';
    if (ORDER_STATUSES.some(o => o.value === status)) return status;
    return 'received';
}

function renderConsumerView() {
    const list = document.getElementById('consumerOrdersList');
    const myOrders = getConsumerOrders(currentUser.name);

    if (myOrders.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>등록된 주문이 없습니다.</p><p>위 폼에서 새 주문을 등록하세요.</p></div>';
        return;
    }

    list.innerHTML = myOrders.map(order => {
        const hasChangeRequest = order.changeRequest && order.changeRequest.status === 'pending';
        const canRequestChange = !hasChangeRequest && ['reviewing', 'confirmed', 'received'].includes(normalizeStatus(order.status));
        const canApprove = hasChangeRequest && order.changeRequest.requestedBy === 'supplier';

        return `
        <div class="order-item ${hasChangeRequest ? 'has-change-request' : ''}">
            <div class="order-id">${order.id}</div>
            <div class="order-detail">${formatOrderDateTime(order)} · 트레일러 ${order.tubeTrailers}대</div>
            <div class="order-detail">${order.address}</div>
            <span class="order-status ${normalizeStatus(order.status)}">${getStatusLabel(order.status)}</span>
            ${hasChangeRequest ? `<div class="order-change-note">${order.changeRequest.requestedBy === 'supplier' ? '공급자' : '수요자'}의 변경 요청 대기</div>` : ''}
            <div class="order-actions">
                ${canRequestChange ? `<button type="button" class="btn btn-small" data-action="request-change" data-id="${order.id}">변경 요청</button>` : ''}
                ${canApprove ? `<button type="button" class="btn btn-small btn-primary" data-action="approve-change" data-id="${order.id}">변경 동의</button>
                <button type="button" class="btn btn-small btn-secondary" data-action="reject-change" data-id="${order.id}">거절</button>` : ''}
            </div>
        </div>
    `}).join('');
}

function renderOrdersTable(tbodyId, showActions) {
    const allOrders = getAllOrders();
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const colspan = 9;
    tbody.innerHTML = allOrders.map(o => {
        const hasChangeRequest = o.changeRequest && o.changeRequest.status === 'pending';
        const canRequestChange = showActions && !hasChangeRequest && ['reviewing', 'confirmed', 'received'].includes(normalizeStatus(o.status));
        const canApprove = showActions && hasChangeRequest && o.changeRequest.requestedBy === 'consumer';
        const currentStatus = normalizeStatus(o.status);
        const travelTime = getTravelTimeFromAddress(o.address);

        const statusSelect = showActions ? `
            <select class="status-toggle" data-order-id="${o.id}" title="상태 변경">
                ${ORDER_STATUSES.map(s => `<option value="${s.value}" ${currentStatus === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
        ` : `<span class="order-status ${currentStatus}">${getStatusLabel(o.status)}</span>`;

        return `
        <tr class="order-row ${hasChangeRequest ? 'row-change-request' : ''}" data-order-id="${o.id}" title="클릭하여 지도 보기">
            <td>${o.id}</td>
            <td>${o.consumerName}</td>
            <td>${formatOrderDate(o)}</td>
            <td>${o.time}</td>
            <td>${o.tubeTrailers}대</td>
            <td>${o.address}</td>
            <td><span class="travel-time">${travelTime}분</span></td>
            <td>${statusSelect}</td>
            <td class="table-actions">
                ${canRequestChange ? `<button type="button" class="btn btn-tiny" data-action="request-change" data-id="${o.id}">변경요청</button>` : ''}
                ${canApprove ? `<button type="button" class="btn btn-tiny btn-primary" data-action="approve-change" data-id="${o.id}">동의</button>
                <button type="button" class="btn btn-tiny btn-secondary" data-action="reject-change" data-id="${o.id}">거절</button>` : ''}
            </td>
        </tr>
    `}).join('') || `<tr><td colspan="${colspan}" class="empty-state">주문이 없습니다.</td></tr>`;

    // 상태 토글 이벤트
    tbody.querySelectorAll('.status-toggle').forEach(sel => {
        sel.addEventListener('change', (e) => {
            e.stopPropagation();
            const orderId = e.target.dataset.orderId;
            const newStatus = e.target.value;
            const order = orders.find(o => o.id === orderId);
            if (order) {
                order.status = newStatus;
                if (newStatus !== 'change_requested') order.changeRequest = null;
                localStorage.setItem('h2go_orders', JSON.stringify(orders));
                renderConsumerView();
                renderSupplierView();
            }
        });
    });

    // 테이블 액션 버튼 클릭 시 지도 열기 방지
    tbody.querySelectorAll('.table-actions button').forEach(btn => {
        btn.addEventListener('click', e => e.stopPropagation());
    });

    // 주문 행 클릭 → 지도 모달
    tbody.querySelectorAll('.order-row[data-order-id]').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('select') || e.target.closest('button')) return;
            const orderId = row.dataset.orderId;
            openOrderMapModal(orderId);
        });
    });
}

function renderSupplierView() {
    const allOrders = getAllOrders();
    const totalTrailers = allOrders.reduce((s, o) => s + (o.tubeTrailers || 0), 0);

    document.getElementById('totalOrders').textContent = allOrders.length;
    const totalEl = document.getElementById('totalTrailers');
    if (totalEl) totalEl.textContent = totalTrailers + '대';

    if (allOrders.length > 0) {
        const dates = allOrders.map(o => formatOrderDate(o));
        const uniqueDates = [...new Set(dates)];
        document.getElementById('deliveryRange').textContent = uniqueDates.length === 1 ? uniqueDates[0] : `${uniqueDates[0]} ~ ${uniqueDates[uniqueDates.length - 1]}`;
    } else {
        document.getElementById('deliveryRange').textContent = '-';
    }

    renderOrdersTable('supplierOrdersTable', true);

    const totalQty = allOrders.reduce((s, o) => s + getOrderQuantity(o), 0);
    const planEl = document.getElementById('productionPlanSummary');
    if (planEl) {
        planEl.innerHTML = `
            <div class="plan-item"><span>총 트레일러 필요</span><strong>${totalTrailers}대</strong></div>
            <div class="plan-item"><span>예상 수소량 (400kg/대)</span><strong>${totalQty.toLocaleString()} kg</strong></div>
            <div class="plan-item"><span>주문 수요처 수</span><strong>${new Set(allOrders.map(o => o.address)).size}곳</strong></div>
        `;
    }

    // AI 운송계획 (통합)
    const transportPlan = calculateTransportPlan();
    const aiPlanEl = document.getElementById('aiTransportPlan');
    const scheduleEl = document.getElementById('transportSchedule');

    if (!transportPlan) {
        if (aiPlanEl) aiPlanEl.innerHTML = '<div class="empty-state"><p>확정/검토 중 주문이 없습니다.</p></div>';
        if (scheduleEl) scheduleEl.innerHTML = '';
    } else {
        if (aiPlanEl) {
            aiPlanEl.innerHTML = `
                <div class="ai-plan-item highlight">
                    <span class="label">총 트레일러</span>
                    <span class="value">${transportPlan.totalTrailers}대 (${transportPlan.totalQuantity.toLocaleString()} kg)</span>
                </div>
                <div class="ai-plan-item">
                    <span class="label">필요 트레일러 수</span>
                    <span class="value">${transportPlan.trailersNeeded}대 ${transportPlan.trailersNeeded > transportPlan.trailersAvailable ? '(⚠ 부족)' : ''}</span>
                </div>
                <div class="ai-plan-item">
                    <span class="label">가용 트레일러</span>
                    <span class="value">${transportPlan.trailersAvailable}대</span>
                </div>
                <div class="ai-plan-item">
                    <span class="label">필요 운송기사 수</span>
                    <span class="value">${transportPlan.driversNeeded}명 ${transportPlan.driversNeeded > transportPlan.driversAvailable ? '(⚠ 부족)' : ''}</span>
                </div>
                <div class="ai-plan-item">
                    <span class="label">가용 운송기사</span>
                    <span class="value">${transportPlan.driversAvailable}명</span>
                </div>
                <div class="ai-plan-item">
                    <span class="label">총 배송 횟수</span>
                    <span class="value">${transportPlan.totalTrips}회</span>
                </div>
                <div class="ai-plan-item">
                    <span class="label">예상 총 운송시간</span>
                    <span class="value">약 ${Math.round(transportPlan.totalDriveTime)}분 (왕복)</span>
                </div>
                ${transportPlan.hasShortage ? '<div class="ai-plan-item" style="border-left:4px solid #f59e0b;"><span class="label">⚠ 권장</span><span class="value">트레일러 또는 기사 추가 필요</span></div>' : ''}
            `;
        }
        if (scheduleEl) {
            scheduleEl.innerHTML = transportPlan.schedule.map(s => `
                <div class="schedule-item">
                    <span class="time">${s.time}</span>
                    <span class="route">${s.route}</span>
                    <span class="quantity">${s.quantity}</span>
                    <span class="trailer">${s.trailer} · ${s.driver}</span>
                </div>
            `).join('');
        }
    }
}

// ========== 주문 지도 모달 ==========
let orderMapInstance = null;

function openOrderMapModal(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const destCoords = getCoordinatesFromAddress(order.address);
    const travelTime = getTravelTimeFromAddress(order.address);

    document.getElementById('orderMapTitle').textContent = `주문 ${order.id} - 튜브트레일러 배송 경로`;
    document.getElementById('orderMapInfo').innerHTML = `
        <div class="map-info-row"><strong>수요처:</strong> ${order.consumerName}</div>
        <div class="map-info-row"><strong>납품지:</strong> ${order.address}</div>
        <div class="map-info-row"><strong>트레일러:</strong> ${order.tubeTrailers}대</div>
        <div class="map-info-row"><strong>생산지→수요처 운송시간:</strong> 약 ${travelTime}분</div>
    `;

    document.getElementById('orderMapModal').classList.add('active');

    // 기존 map 제거
    const mapEl = document.getElementById('orderMap');
    mapEl.innerHTML = '';

    if (typeof L !== 'undefined') {
        const map = L.map('orderMap').setView([37.45, 126.9], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        // 생산지 마커
        const prodIcon = L.divIcon({
            className: 'custom-marker prod-marker',
            html: '<div class="marker-pin prod">🏭</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        });
        L.marker([PRODUCTION_SITE.lat, PRODUCTION_SITE.lng], { icon: prodIcon })
            .addTo(map)
            .bindPopup(`<b>${PRODUCTION_SITE.name}</b><br>생산지`);

        // 수요처 마커 (튜브트레일러 도착지)
        const destIcon = L.divIcon({
            className: 'custom-marker dest-marker',
            html: '<div class="marker-pin dest">🚛</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        });
        L.marker([destCoords.lat, destCoords.lng], { icon: destIcon })
            .addTo(map)
            .bindPopup(`<b>${order.address}</b><br>수요처 (트레일러 ${order.tubeTrailers}대)`);

        // 경로선
        L.polyline([
            [PRODUCTION_SITE.lat, PRODUCTION_SITE.lng],
            [destCoords.lat, destCoords.lng]
        ], { color: '#3B82F6', weight: 3, dashArray: '5, 10' }).addTo(map);

        map.fitBounds([
            [PRODUCTION_SITE.lat, PRODUCTION_SITE.lng],
            [destCoords.lat, destCoords.lng]
        ], { padding: [50, 50] });

        orderMapInstance = map;
    } else {
        mapEl.innerHTML = '<div class="empty-state"><p>지도를 불러올 수 없습니다.</p></div>';
    }
}

function closeOrderMapModal() {
    document.getElementById('orderMapModal').classList.remove('active');
    if (orderMapInstance) {
        orderMapInstance.remove();
        orderMapInstance = null;
    }
}

// ========== 변경 요청 ==========
function openChangeRequestModal(orderId, requestedBy) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('changeOrderId').value = orderId;
    document.getElementById('changeRequestedBy').value = requestedBy;
    document.getElementById('changeYear').value = order.year;
    document.getElementById('changeMonth').value = order.month;
    document.getElementById('changeDay').value = order.day;
    document.getElementById('changeTrailers').value = order.tubeTrailers;
    document.getElementById('changeAddress').value = order.address;

    const [h, m] = (order.time || '09:00').split(':');
    document.getElementById('changeHour').value = h;
    document.getElementById('changeMinute').value = m || '00';

    document.getElementById('changeModalTitle').textContent = requestedBy === 'consumer' ? '주문 변경 요청 (공급자 동의 필요)' : '주문 변경 제안 (수요자 동의 필요)';
    document.getElementById('changeRequestModal').classList.add('active');
}

function openApprovalModal(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.changeRequest || order.changeRequest.status !== 'pending') return;

    pendingApprovalOrderId = orderId;
    const cr = order.changeRequest;
    const body = document.getElementById('approvalModalBody');
    body.innerHTML = `
        <p><strong>주문 ${order.id}</strong></p>
        <p>${cr.requestedBy === 'consumer' ? '수요자' : '공급자'}가 아래와 같이 변경을 요청했습니다.</p>
        <div class="change-diff">
            <p><strong>현재:</strong> ${order.year}/${order.month}/${order.day} ${order.time}, 트레일러 ${order.tubeTrailers}대</p>
            <p><strong>변경 후:</strong> ${cr.proposed.year}/${cr.proposed.month}/${cr.proposed.day} ${cr.proposed.time}, 트레일러 ${cr.proposed.tubeTrailers}대</p>
            <p><strong>주소:</strong> ${cr.proposed.address || order.address}</p>
        </div>
    `;
    document.getElementById('approvalModalTitle').textContent = '변경 요청 검토 - 동의하시겠습니까?';
    document.getElementById('changeApprovalModal').classList.add('active');
}

function applyChange(orderId, approved) {
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.changeRequest) return;

    if (approved) {
        const p = order.changeRequest.proposed;
        order.year = p.year;
        order.month = p.month;
        order.day = p.day;
        order.time = p.time;
        order.tubeTrailers = p.tubeTrailers;
        if (p.address) order.address = p.address;
    }

    order.changeRequest = null;
    order.status = approved ? 'confirmed' : 'reviewing';

    localStorage.setItem('h2go_orders', JSON.stringify(orders));
    pendingApprovalOrderId = null;
    document.getElementById('changeApprovalModal').classList.remove('active');
    renderConsumerView();
    renderSupplierView();
}

// ========== 이벤트 ==========
function initTimeInputs() {
    const hourEl = document.getElementById('orderHour');
    if (hourEl && !hourEl.value) {
        hourEl.value = new Date().getHours();
    }
}

function initFormDefaults() {
    const today = getTodayParts();
    const yearEl = document.getElementById('orderYear');
    const monthEl = document.getElementById('orderMonth');
    const dayEl = document.getElementById('orderDay');
    if (yearEl) yearEl.value = today.year;
    if (monthEl) monthEl.value = today.month;
    if (dayEl) dayEl.value = today.day;
}

document.getElementById('roleSelect').addEventListener('change', (e) => {
    const role = e.target.value;
    currentUser.type = role;
    currentUser.name = role === 'consumer' ? '수요자 A' : '공급자';
    document.getElementById('userBadge').textContent = currentUser.name;
    showView(role);
    if (role === 'consumer') renderConsumerView();
    if (role === 'supplier') renderSupplierView();
});

document.getElementById('orderForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const order = {
        id: generateOrderId(),
        consumerName: currentUser.name,
        year: parseInt(document.getElementById('orderYear').value),
        month: parseInt(document.getElementById('orderMonth').value),
        day: parseInt(document.getElementById('orderDay').value),
        time: `${String(document.getElementById('orderHour').value).padStart(2, '0')}:${document.getElementById('orderMinute').value}`,
        tubeTrailers: parseInt(document.getElementById('orderTrailers').value),
        address: document.getElementById('orderAddress').value,
        note: document.getElementById('orderNote').value,
        status: 'received',
        createdAt: new Date().toISOString()
    };
    orders.push(order);
    localStorage.setItem('h2go_orders', JSON.stringify(orders));
    document.getElementById('orderForm').reset();
    initFormDefaults();
    initTimeInputs();
    renderConsumerView();
    renderSupplierView();
    renderTransporterView();
    alert('주문이 등록되었습니다. 공급자에게 전달됩니다.');
});

document.getElementById('changeRequestForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const orderId = document.getElementById('changeOrderId').value;
    const requestedBy = document.getElementById('changeRequestedBy').value;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const proposed = {
        year: parseInt(document.getElementById('changeYear').value),
        month: parseInt(document.getElementById('changeMonth').value),
        day: parseInt(document.getElementById('changeDay').value),
        time: `${String(document.getElementById('changeHour').value).padStart(2, '0')}:${document.getElementById('changeMinute').value}`,
        tubeTrailers: parseInt(document.getElementById('changeTrailers').value),
        address: document.getElementById('changeAddress').value
    };

    order.changeRequest = { requestedBy, proposed, status: 'pending' };
    order.status = 'change_requested';

    localStorage.setItem('h2go_orders', JSON.stringify(orders));
    document.getElementById('changeRequestModal').classList.remove('active');
    renderConsumerView();
    renderSupplierView();
    alert('변경 요청이 제출되었습니다. 상대방의 동의를 기다립니다.');
});

document.getElementById('approveChangeBtn').addEventListener('click', () => {
    if (pendingApprovalOrderId) applyChange(pendingApprovalOrderId, true);
    alert('변경이 적용되었습니다.');
});

document.getElementById('rejectChangeBtn').addEventListener('click', () => {
    if (pendingApprovalOrderId) applyChange(pendingApprovalOrderId, false);
    alert('변경 요청이 거절되었습니다.');
});

document.getElementById('changeRequestModal').addEventListener('click', (e) => {
    if (e.target.id === 'changeRequestModal') e.target.classList.remove('active');
});
document.getElementById('orderMapModal').addEventListener('click', (e) => {
    if (e.target.id === 'orderMapModal') closeOrderMapModal();
});
document.querySelector('#orderMapModal .modal-close')?.addEventListener('click', closeOrderMapModal);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('orderMapModal').classList.contains('active')) {
        closeOrderMapModal();
    }
});
document.querySelector('#changeRequestModal .modal-close').addEventListener('click', () => {
    document.getElementById('changeRequestModal').classList.remove('active');
});
document.getElementById('changeApprovalModal').addEventListener('click', (e) => {
    if (e.target.id === 'changeApprovalModal') e.target.classList.remove('active');
});
document.querySelector('#changeApprovalModal .modal-close').addEventListener('click', () => {
    document.getElementById('changeApprovalModal').classList.remove('active');
});

document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const orderId = btn.dataset.id;
    if (action === 'request-change') {
        const isConsumer = currentUser.type === 'consumer';
        openChangeRequestModal(orderId, isConsumer ? 'consumer' : 'supplier');
    } else if (action === 'approve-change') {
        openApprovalModal(orderId);
    } else if (action === 'reject-change') {
        if (confirm('변경 요청을 거절하시겠습니까?')) {
            applyChange(orderId, false);
            alert('변경 요청이 거절되었습니다.');
        }
    }
});

document.getElementById('recalculateBtn')?.addEventListener('click', () => renderSupplierView());

// 초기화
const urlParams = new URLSearchParams(window.location.search);
const initialRole = urlParams.get('role') === 'transporter' ? 'supplier' : (urlParams.get('role') || 'consumer');
currentUser.type = initialRole;
currentUser.name = initialRole === 'consumer' ? '수요자 A' : '공급자';
document.getElementById('userBadge').textContent = currentUser.name;
document.getElementById('roleSelect').value = initialRole;

initFormDefaults();
initTimeInputs();
showView(initialRole);
if (initialRole === 'consumer') renderConsumerView();
if (initialRole === 'supplier') renderSupplierView();

// 데모 데이터 (신규 또는 구형 데이터 마이그레이션)
const needsMigration = orders.some(o => !o.tubeTrailers && o.quantity != null);
if (orders.length === 0 || needsMigration) {
    const today = getTodayParts();
    orders = [
        { id: 'ORD-DEMO1', consumerName: '수요자 A', year: today.year, month: today.month, day: today.day, time: '09:00', tubeTrailers: 2, address: '서울시 강남구 테헤란로 123', note: '', status: 'received', createdAt: new Date().toISOString() },
        { id: 'ORD-DEMO2', consumerName: '수요자 B', year: today.year, month: today.month, day: today.day, time: '10:30', tubeTrailers: 3, address: '인천시 중구 공항로 272', note: '', status: 'confirmed', createdAt: new Date().toISOString() },
        { id: 'ORD-DEMO3', consumerName: '수요자 C', year: today.year, month: today.month, day: today.day, time: '14:00', tubeTrailers: 1, address: '경기도 수원시 영통구 광교중앙로 120', note: '', status: 'reviewing', createdAt: new Date().toISOString() }
    ];
    localStorage.setItem('h2go_orders', JSON.stringify(orders));
}
