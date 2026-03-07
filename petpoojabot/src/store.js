import { create } from 'zustand';

export const useStore = create((set, get) => ({
    // Cart state
    cart: [],
    addToCart: (item) => set((state) => {
        const existing = state.cart.find(c => c.id === item.id);
        if (existing) {
            return { cart: state.cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + (item.quantity || 1), instructions: item.instructions || c.instructions } : c) };
        }
        return { cart: [...state.cart, { ...item, quantity: item.quantity || 1, instructions: item.instructions || null }] };
    }),
    removeFromCart: (id) => set((state) => ({
        cart: state.cart.filter(c => c.id !== id)
    })),
    updateQuantity: (id, change) => set((state) => ({
        cart: state.cart.map(c => {
            if (c.id === id) {
                const newQuantity = c.quantity + change;
                return newQuantity > 0 ? { ...c, quantity: newQuantity } : c;
            }
            return c;
        })
    })),
    clearCart: () => set({ cart: [] }),

    // Voice-triggered highlight
    lastVoiceAddedId: null,
    setLastVoiceAddedId: (id) => set({ lastVoiceAddedId: id }),

    // User preferences
    vegOnly: false,
    toggleVegOnly: () => set((state) => ({ vegOnly: !state.vegOnly })),

    // Selected Filters
    filters: [],
    toggleFilter: (filter) => set((state) => {
        if (state.filters.includes(filter)) {
            return { filters: state.filters.filter(f => f !== filter) };
        }
        return { filters: [...state.filters, filter] };
    }),

    // Order Details (for order tracking)
    currentOrder: null,
    setCurrentOrder: (order) => set({ currentOrder: order }),

    // Delivery & Address State
    deliveryAddress: null,
    setDeliveryAddress: (address) => set({ deliveryAddress: address }),

    // Derived cart totals
    getCartTotals: () => {
        const cart = get().cart;
        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const tax = subtotal * 0.05; // 5% GST
        const deliveryFee = subtotal > 200 || subtotal === 0 ? 0 : 30;
        const total = subtotal + tax + deliveryFee;
        return { subtotal, tax, deliveryFee, total };
    }
}));
