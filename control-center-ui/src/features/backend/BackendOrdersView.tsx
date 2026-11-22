import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CopyCheck,
  History,
  Info,
  KeyRound,
  Minus,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { BridgeApiError, apiBridge } from '../../services/bridge';
import type {
  FeatureViewProps,
  OrderCreateRequest,
  OrderItemResponse,
  OrderResponse,
  PageResponse,
  ProductCreateRequest,
  ProductResponse,
  UserCreateRequest,
  UserResponse,
} from '../../types';
import {
  extractErrorMessage,
  formatTimestamp,
  formatUsd,
  generateIdempotencyKey,
  syncOrdersTelemetry,
} from './backendHelpers';
import { ProductFormModal } from './ProductFormModal';

type OrdersSubTab = 'shop' | 'orders' | 'users';

interface CartItem {
  product: ProductResponse;
  quantity: number;
}

interface IdempotencyAttempt {
  id: string;
  key: string;
  orderId: number;
  totalAmount: number;
  replay: boolean;
  timestamp: string;
}

export const BackendOrdersView: React.FC<FeatureViewProps> = ({
  mode,
  onRateLimitUpdate,
  onActivityPulse,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<OrdersSubTab>('shop');

  // Users state
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newUser, setNewUser] = useState<UserCreateRequest>({
    name: '',
    email: '',
    address: '',
  });
  const [creatingUser, setCreatingUser] = useState(false);

  // Products state
  const [productPage, setProductPage] = useState<PageResponse<ProductResponse> | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [appliedMinPrice, setAppliedMinPrice] = useState<number | undefined>(undefined);
  const [appliedMaxPrice, setAppliedMaxPrice] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(6);
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'unitPrice' | 'quantity'>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Product modal & delete confirm state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductResponse | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productModalError, setProductModalError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Cart & Idempotency Lab state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const [placingOrder, setPlacingOrder] = useState(false);
  const [replayingOrder, setReplayingOrder] = useState(false);
  const [lastSubmittedReq, setLastSubmittedReq] = useState<OrderCreateRequest | null>(null);
  const [lastOrderResult, setLastOrderResult] = useState<{
    order: OrderResponse;
    isReplay: boolean;
    keyUsed: string;
  } | null>(null);
  const [knownKeyOrders, setKnownKeyOrders] = useState<Record<string, number>>({
    'ord-seed-1001': 1001,
  });
  const [idempotencyLog, setIdempotencyLog] = useState<IdempotencyAttempt[]>([]);

  // Order history & items inspector state
  const [userOrders, setUserOrders] = useState<OrderResponse[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<number, OrderItemResponse[]>>({});
  const [loadingItemsOrderId, setLoadingItemsOrderId] = useState<number | null>(null);

  // Global banner error / notice
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const handleApiError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof BridgeApiError) {
        syncOrdersTelemetry(onRateLimitUpdate, onActivityPulse, err.rateLimit);
        setRateLimited(err.status === 429);
      }
      setBannerError(extractErrorMessage(err, fallback));
    },
    [onActivityPulse, onRateLimitUpdate]
  );

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const list = await apiBridge.orders.getUsers();
      setUsers(list);
      setRateLimited(false);
      syncOrdersTelemetry(onRateLimitUpdate, onActivityPulse);
      setSelectedUserId((prev) => {
        if (prev !== null && list.some((u) => u.userId === prev)) return prev;
        return list.length > 0 ? list[0].userId : null;
      });
    } catch (err) {
      handleApiError(err, 'Failed to fetch users');
    } finally {
      setLoadingUsers(false);
    }
  }, [handleApiError, onActivityPulse, onRateLimitUpdate]);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await apiBridge.orders.getProducts({
        page,
        size: pageSize,
        sortBy,
        sortDir,
        name: appliedName || undefined,
        minPrice: appliedMinPrice,
        maxPrice: appliedMaxPrice,
      });
      setProductPage(res);
      setRateLimited(false);
      syncOrdersTelemetry(onRateLimitUpdate, onActivityPulse);
    } catch (err) {
      handleApiError(err, 'Failed to load products catalog');
    } finally {
      setLoadingProducts(false);
    }
  }, [
    appliedMaxPrice,
    appliedMinPrice,
    appliedName,
    handleApiError,
    onActivityPulse,
    onRateLimitUpdate,
    page,
    pageSize,
    sortBy,
    sortDir,
  ]);

  const loadUserOrders = useCallback(
    async (userId: number | null) => {
      if (userId === null) {
        setUserOrders([]);
        return;
      }
      setLoadingOrders(true);
      try {
        const list = await apiBridge.orders.getOrdersByUser(userId);
        setUserOrders(list);
        setRateLimited(false);
        syncOrdersTelemetry(onRateLimitUpdate, onActivityPulse);
      } catch (err) {
        handleApiError(err, `Failed to load orders for user #${userId}`);
      } finally {
        setLoadingOrders(false);
      }
    },
    [handleApiError, onActivityPulse, onRateLimitUpdate]
  );

  useEffect(() => {
    setBannerError(null);
    setRateLimited(false);
    setCart([]);
    setLastSubmittedReq(null);
    setLastOrderResult(null);
    setExpandedOrderId(null);
    setOrderItemsMap({});
    void loadUsers();
  }, [mode, loadUsers]);

  useEffect(() => {
    void loadProducts();
  }, [mode, loadProducts]);

  useEffect(() => {
    void loadUserOrders(selectedUserId);
  }, [mode, selectedUserId, loadUserOrders]);

  const handleResetSimWindow = () => {
    apiBridge.orders.resetSimRateLimit();
    setBannerError(null);
    setRateLimited(false);
    syncOrdersTelemetry(onRateLimitUpdate, onActivityPulse);
  };

  // User Creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.address.trim()) {
      setBannerError('Please fill in name, email, and address to create a user.');
      return;
    }
    setCreatingUser(true);
    setBannerError(null);
    try {
      const created = await apiBridge.orders.createUser(newUser);
      syncOrdersTelemetry(onRateLimitUpdate, onActivityPulse);
      setUsers((prev) => [...prev, created]);
      setSelectedUserId(created.userId);
      setNewUser({ name: '', email: '', address: '' });
      setShowNewUserForm(false);
    } catch (err) {
      handleApiError(err, 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  // Product Filters
  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setAppliedName(searchName.trim());
    setAppliedMinPrice(minPrice.trim() ? Number(minPrice) : undefined);
    setAppliedMaxPrice(maxPrice.trim() ? Number(maxPrice) : undefined);
  };

  const handleClearFilters = () => {
    setSearchName('');
    setMinPrice('');
    setMaxPrice('');
    setAppliedName('');
    setAppliedMinPrice(undefined);
    setAppliedMaxPrice(undefined);
    setPage(0);
  };

  // Product CRUD
  const openCreateModal = () => {
    setEditingProduct(null);
    setProductModalError(null);
    setProductModalOpen(true);
  };

  const openEditModal = (product: ProductResponse) => {
    setEditingProduct(product);
    setProductModalError(null);
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (payload: ProductCreateRequest, productId?: number) => {
    setSavingProduct(true);
    setProductModalError(null);
    try {
      const saved = productId
        ? await apiBridge.orders.updateProduct(productId, payload)
        : await apiBridge.orders.createProduct(payload);
      syncOrdersTelemetry(onRateLimitUpdate, onActivityPulse);
      setCart((prev) =>
        prev.map((item) =>
          item.product.productId === saved.productId
            ? {
                product: saved,
                quantity: Math.min(item.quantity, Math.max(1, saved.quantity)),
              }
            : item
        )
      );
      setProductModalOpen(false);
      await loadProducts();
    } catch (err) {
      if (err instanceof BridgeApiError) {
        syncOrdersTelemetry(onRateLimitUpdate, onActivityPulse, err.rateLimit);
      }
      setProductModalError(extractErrorMessage(err, 'Failed to save product'));
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    setDeletingId(id);
    setBannerError(null);
    try {
      await apiBridge.orders.deleteProduct(id);
      syncOrdersTelemetry(onRateLimitUpdate, onActivityPulse);
      setCart((prev) => prev.filter((item) => item.product.productId !== id));
      setConfirmDeleteId(null);
      await loadProducts();
    } catch (err) {
      handleApiError(err, `Failed to delete product #${id}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Cart Actions
  const handleAddToCart = (product: ProductResponse) => {
    if (!product.inStock || product.quantity <= 0) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.product.productId === product.productId);
      if (existing) {
        if (existing.quantity >= product.quantity) return prev;
        return prev.map((c) =>
          c.product.productId === product.productId
            ? { ...c, product, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateCartQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product.productId !== productId) return c;
          const nextQty = c.quantity + delta;
          if (nextQty <= 0) return null;
          return { ...c, quantity: Math.min(nextQty, c.product.quantity) };
        })
        .filter((x): x is CartItem => x !== null)
    );
  };

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.unitPrice * item.quantity, 0),
    [cart]
  );

  const totalCartUnits = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const executeOrderRequest = async (req: OrderCreateRequest, isReplayAction: boolean) => {
    if (isReplayAction) {
      setReplayingOrder(true);
    } else {
      setPlacingOrder(true);
    }
    setBannerError(null);

    try {
      const order = await apiBridge.orders.createOrder(req);
      syncOrdersTelemetry(onRateLimitUpdate, onActivityPulse);

      const detectedReplay =
        typeof order.idempotentReplay === 'boolean'
          ? order.idempotentReplay
          : knownKeyOrders[req.idempotencyKey] === order.orderId;

      setKnownKeyOrders((prev) => ({
        ...prev,
        [req.idempotencyKey]: order.orderId,
      }));
      setLastSubmittedReq(req);
      setLastOrderResult({
        order,
        isReplay: detectedReplay,
        keyUsed: req.idempotencyKey,
      });

      setIdempotencyLog((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          key: req.idempotencyKey,
          orderId: order.orderId,
          totalAmount: order.totalAmount,
          replay: detectedReplay,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 4),
      ]);

      if (!detectedReplay) {
        setCart([]);
        await Promise.all([loadProducts(), loadUserOrders(req.userId)]);
      }
    } catch (err) {
      handleApiError(err, 'Failed to place order');
    } finally {
      setPlacingOrder(false);
      setReplayingOrder(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (selectedUserId === null) {
      setBannerError('Select or create a customer before placing an order.');
      return;
    }
    if (cart.length === 0) {
      setBannerError('Add at least one product to the cart.');
      return;
    }
    const cleanKey = idempotencyKey.trim();
    if (!cleanKey) {
      setBannerError('Idempotency key cannot be empty.');
      return;
    }

    const req: OrderCreateRequest = {
      userId: selectedUserId,
      items: cart.map((c) => ({
        productId: c.product.productId,
        quantity: c.quantity,
      })),
      idempotencyKey: cleanKey,
    };

    await executeOrderRequest(req, false);
  };

  const handleReplaySameKey = async () => {
    const cleanKey = idempotencyKey.trim();
    if (!cleanKey) {
      setBannerError('Enter or generate an idempotency key to replay.');
      return;
    }

    let reqToReplay: OrderCreateRequest | null = null;
    if (cart.length > 0 && selectedUserId !== null) {
      reqToReplay = {
        userId: selectedUserId,
        items: cart.map((c) => ({
          productId: c.product.productId,
          quantity: c.quantity,
        })),
        idempotencyKey: cleanKey,
      };
    } else if (lastSubmittedReq) {
      reqToReplay = {
        ...lastSubmittedReq,
        idempotencyKey: cleanKey,
      };
    } else if (selectedUserId !== null && productPage?.content.length) {
      const firstInStock = productPage.content.find((p) => p.inStock && p.quantity > 0);
      if (firstInStock) {
        reqToReplay = {
          userId: selectedUserId,
          items: [{ productId: firstInStock.productId, quantity: 1 }],
          idempotencyKey: cleanKey,
        };
      }
    }

    if (!reqToReplay) {
      setBannerError('Add an item to the cart or place an initial order first to replay its key.');
      return;
    }

    await executeOrderRequest(reqToReplay, true);
  };

  // Order Items Inspector
  const handleToggleOrderItems = async (orderId: number) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (orderItemsMap[orderId]) return;

    setLoadingItemsOrderId(orderId);
    try {
      const items = await apiBridge.orders.getOrderItems(orderId);
      syncOrdersTelemetry(onRateLimitUpdate, onActivityPulse);
      setOrderItemsMap((prev) => ({ ...prev, [orderId]: items }));
    } catch (err) {
      handleApiError(err, `Failed to inspect items for order #${orderId}`);
    } finally {
      setLoadingItemsOrderId(null);
    }
  };

  const selectedUser = users.find((u) => u.userId === selectedUserId) ?? null;

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Commerce &amp; Orders
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Browse inventory, test idempotent checkout keys, and inspect customer orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented Sub-Tabs */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setActiveSubTab('shop')}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
                activeSubTab === 'shop'
                  ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              Shop &amp; Place Order
              {totalCartUnits > 0 && (
                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {totalCartUnits}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('orders')}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
                activeSubTab === 'orders'
                  ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <History className="h-4 w-4" />
              Order History
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                {userOrders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('users')}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
                activeSubTab === 'users'
                  ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Users className="h-4 w-4" />
              Users ({users.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadUsers();
              void loadProducts();
              void loadUserOrders(selectedUserId);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title="Sync all commerce data"
          >
            <RefreshCw className="h-4 w-4" />
            Sync
          </button>
        </div>
      </div>

      {/* Error / Rate Limit Banner */}
      {bannerError && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-sm ${
            rateLimited
              ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200'
              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{bannerError}</span>
          </div>
          <div className="flex items-center gap-2">
            {rateLimited && mode === 'sim' && (
              <button
                type="button"
                onClick={handleResetSimWindow}
                className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-700 dark:bg-rose-900/50 dark:text-rose-200"
              >
                Reset Sim Rate Window
              </button>
            )}
            <button
              type="button"
              onClick={() => setBannerError(null)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium opacity-75 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: SHOP & PLACE ORDER */}
      {activeSubTab === 'shop' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Products Catalog (Left 7 cols) */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 xl:col-span-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Products Catalog
                </h3>
                {productPage && (
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {productPage.totalElements} items
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </button>
            </div>

            {/* Search, Price & Sort Controls */}
            <div className="mb-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <form onSubmit={handleApplyFilters} className="flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="Search products by name..."
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Min $"
                  className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max $"
                  className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700"
                >
                  Apply
                </button>
                {(appliedName || appliedMinPrice !== undefined || appliedMaxPrice !== undefined) && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
                  >
                    Clear
                  </button>
                )}
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-700/60">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Sort &amp; Display
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value as typeof sortBy);
                      setPage(0);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    aria-label="Sort field"
                  >
                    <option value="id">Sort: Default (ID)</option>
                    <option value="name">Sort: Name</option>
                    <option value="unitPrice">Sort: Price</option>
                    <option value="quantity">Sort: Stock</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                      setPage(0);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {sortDir === 'asc' ? 'Ascending' : 'Descending'}
                  </button>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(0);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    aria-label="Page size"
                  >
                    <option value={6}>6 per page</option>
                    <option value={8}>8 per page</option>
                    <option value={12}>12 per page</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Product Grid */}
            {loadingProducts && !productPage ? (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                Loading products...
              </div>
            ) : !productPage || productPage.empty ? (
              <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No products match your search criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {productPage.content.map((product) => {
                  const inCart = cart.find((c) => c.product.productId === product.productId);
                  const cartQty = inCart?.quantity ?? 0;
                  const outOfStock = !product.inStock || product.quantity <= 0;
                  const lowStock = !outOfStock && product.quantity <= 5;
                  const maxedOut = cartQty >= product.quantity;

                  return (
                    <div
                      key={product.productId}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            SKU #{product.productId}
                          </span>
                          {outOfStock ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300">
                              Out of Stock
                            </span>
                          ) : lowStock ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                              Low Stock ({product.quantity})
                            </span>
                          ) : (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                              In Stock ({product.quantity})
                            </span>
                          )}
                        </div>

                        <h4 className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {product.name}
                        </h4>
                        <div className="mt-1.5 font-mono text-base font-bold text-slate-900 dark:text-slate-100">
                          {formatUsd(product.unitPrice)}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/60">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(product)}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            title="Edit product"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          {confirmDeleteId === product.productId ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={deletingId === product.productId}
                                onClick={() => void handleDeleteProduct(product.productId)}
                                className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                              >
                                {deletingId === product.productId ? '...' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(product.productId)}
                              className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                              title="Delete product"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={outOfStock || maxedOut}
                          onClick={() => handleAddToCart(product)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {cartQty > 0 ? `Added (${cartQty})` : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Footer */}
            {productPage && (
              <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
                <span>
                  Page <strong className="text-slate-900 dark:text-slate-100">{productPage.currentPage + 1}</strong> of{' '}
                  <strong className="text-slate-900 dark:text-slate-100">{productPage.totalPages}</strong> ·{' '}
                  {productPage.totalElements} products
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={productPage.first || loadingProducts}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={productPage.last || loadingProducts}
                    onClick={() => setPage((p) => p + 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Checkout Cart & Idempotency Lab (Right 5 cols) */}
          <section className="space-y-6 xl:col-span-5">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-700/60">
                <div className="flex items-center gap-2.5">
                  <ShoppingCart className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Checkout &amp; Idempotency
                  </h3>
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
                  >
                    Clear Cart
                  </button>
                )}
              </div>

              {/* Customer Selector */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Customer Account
                </label>
                <select
                  value={selectedUserId ?? ''}
                  onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  {users.length === 0 && <option value="">No users available</option>}
                  {users.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      #{u.userId} · {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Cart Items */}
              <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                {cart.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    Your cart is empty. Click <strong className="text-indigo-600 dark:text-indigo-400">Add to Cart</strong> on any in-stock product.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div
                        key={item.product.productId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {item.product.name}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {formatUsd(item.product.unitPrice)} × {item.quantity} ={' '}
                            <span className="font-semibold text-slate-900 dark:text-slate-200">
                              {formatUsd(item.product.unitPrice * item.quantity)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateCartQty(item.product.productId, -1)}
                            className="rounded-md border border-slate-300 bg-slate-50 p-1 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= item.product.quantity}
                            onClick={() => handleUpdateCartQty(item.product.productId, 1)}
                            className="rounded-md border border-slate-300 bg-slate-50 p-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Order Subtotal
                      </span>
                      <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
                        {formatUsd(cartTotal)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Idempotency Key Section */}
              <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <div className="mb-2 flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                    <KeyRound className="h-4 w-4" />
                    Idempotency Key
                  </label>
                  {mode === 'sim' && (
                    <button
                      type="button"
                      onClick={() => setIdempotencyKey('ord-seed-1001')}
                      className="text-xs font-medium text-indigo-600 underline decoration-dotted hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      Try Seed Key (ord-seed-1001)
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={idempotencyKey}
                    onChange={(e) => setIdempotencyKey(e.target.value)}
                    placeholder="idem-XXXX"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setIdempotencyKey(generateIdempotencyKey())}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    title="Generate new key"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    New Key
                  </button>
                </div>

                <div className="mt-2.5 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                  <span>
                    Step 1: Click <strong>Place Order</strong>. Step 2: Click{' '}
                    <strong>Test Idempotency (Replay Same Key)</strong> to verify Redis returns the
                    cached order without double-charging or deducting stock again.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={placingOrder || replayingOrder || cart.length === 0 || selectedUserId === null}
                  onClick={() => void handlePlaceOrder()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {placingOrder ? 'Placing Order...' : 'Place Order'}
                </button>

                <button
                  type="button"
                  disabled={placingOrder || replayingOrder || !idempotencyKey.trim()}
                  onClick={() => void handleReplaySameKey()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40"
                >
                  <Repeat className="h-4 w-4" />
                  {replayingOrder ? 'Replaying Key...' : 'Test Idempotency (Replay Same Key)'}
                </button>
              </div>

              {/* Latest Order / Idempotency Result Card */}
              {lastOrderResult && (
                <div
                  className={`mt-5 rounded-xl border p-4 ${
                    lastOrderResult.isReplay
                      ? 'border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30'
                      : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {lastOrderResult.isReplay ? (
                        <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <CopyCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span
                        className={`text-xs font-bold uppercase tracking-wide ${
                          lastOrderResult.isReplay
                            ? 'text-amber-800 dark:text-amber-300'
                            : 'text-emerald-800 dark:text-emerald-300'
                        }`}
                      >
                        {lastOrderResult.isReplay
                          ? 'Duplicate Request Protected (Replay)'
                          : 'New Order Confirmed'}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Order #{lastOrderResult.order.orderId}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {lastOrderResult.isReplay
                      ? `Key "${lastOrderResult.keyUsed}" matched Redis cache. Returned Order #${lastOrderResult.order.orderId} (${formatUsd(lastOrderResult.order.totalAmount)}) without deducting stock again.`
                      : `Key "${lastOrderResult.keyUsed}" created Order #${lastOrderResult.order.orderId} (${formatUsd(lastOrderResult.order.totalAmount)}). Inventory updated & Kafka event published.`}
                  </p>
                </div>
              )}

              {/* Recent Idempotency Executions */}
              {idempotencyLog.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-700/60">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Recent Checkout Attempts
                  </div>
                  {idempotencyLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/60"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                            entry.replay
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          }`}
                        >
                          {entry.replay ? 'REPLAY' : 'NEW'}
                        </span>
                        <span className="truncate font-mono text-slate-700 dark:text-slate-300">
                          {entry.key}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-slate-600 dark:text-slate-400">
                        #{entry.orderId} · {formatUsd(entry.totalAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: ORDER HISTORY */}
      {activeSubTab === 'orders' && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-700/60">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Customer Order History
              </h3>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Select a customer to view past orders and inspect line-item details.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedUserId ?? ''}
                onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                {users.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    #{u.userId} · {u.name} ({u.email})
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={selectedUserId === null || loadingOrders}
                onClick={() => void loadUserOrders(selectedUserId)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <RefreshCw className={`h-4 w-4 ${loadingOrders ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {loadingOrders ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading orders for {selectedUser?.name ?? 'customer'}...
            </div>
          ) : userOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No orders placed by this customer yet. Head to{' '}
              <button
                type="button"
                onClick={() => setActiveSubTab('shop')}
                className="font-semibold text-indigo-600 underline dark:text-indigo-400"
              >
                Shop &amp; Place Order
              </button>{' '}
              to create one.
            </div>
          ) : (
            <div className="space-y-3">
              {userOrders.map((order) => {
                const isExpanded = expandedOrderId === order.orderId;
                const items = orderItemsMap[order.orderId];
                const loadingItems = loadingItemsOrderId === order.orderId;

                return (
                  <div
                    key={order.orderId}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 transition dark:border-slate-700 dark:bg-slate-900/50"
                  >
                    <button
                      type="button"
                      onClick={() => void handleToggleOrderItems(order.orderId)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-100/80 dark:hover:bg-slate-800/70"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                          ORD-{order.orderId}
                        </span>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {order.status}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Placed {formatTimestamp(order.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-100">
                          {formatUsd(order.totalAmount)}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
                        {loadingItems ? (
                          <div className="py-2 text-sm text-slate-500 dark:text-slate-400">
                            Loading line items...
                          </div>
                        ) : !items || items.length === 0 ? (
                          <div className="py-2 text-sm text-slate-500 dark:text-slate-400">
                            No line items found for this order.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Order Items ({items.length})
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                              {items.map((it, idx) => (
                                <div
                                  key={`${order.orderId}-${it.productId}-${idx}`}
                                  className="flex items-center justify-between py-2 text-sm"
                                >
                                  <div className="text-slate-800 dark:text-slate-200">
                                    {it.productName ?? `Product #${it.productId}`}{' '}
                                    <span className="ml-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                                      ({formatUsd(it.unitPrice)} × {it.quantity})
                                    </span>
                                  </div>
                                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                                    {formatUsd(it.unitPrice * it.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: CUSTOMER ACCOUNTS */}
      {activeSubTab === 'users' && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-700/60">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Customer Accounts ({users.length})
              </h3>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Click any account to select them as the active shopper.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewUserForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <UserPlus className="h-4 w-4" />
              {showNewUserForm ? 'Hide Form' : 'New Customer'}
            </button>
          </div>

          {showNewUserForm && (
            <form
              onSubmit={handleCreateUser}
              className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60 md:grid-cols-4"
            >
              <input
                type="text"
                value={newUser.name}
                onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
                placeholder="Full Name"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                placeholder="Email Address"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="text"
                value={newUser.address}
                onChange={(e) => setNewUser((p) => ({ ...p, address: e.target.value }))}
                placeholder="Shipping Address"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={creatingUser}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {creatingUser ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          )}

          {loadingUsers && users.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading customer accounts...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {users.map((user) => {
                const active = user.userId === selectedUserId;
                return (
                  <button
                    key={user.userId}
                    type="button"
                    onClick={() => setSelectedUserId(user.userId)}
                    className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                      active
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-sm dark:border-indigo-500 dark:bg-indigo-950/30'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {user.name}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {user.email}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
                          active
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        #{user.userId}
                      </span>
                    </div>
                    <div className="mt-3 truncate text-xs text-slate-500 dark:text-slate-400">
                      {user.address}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Product Create/Edit Modal */}
      <ProductFormModal
        isOpen={productModalOpen}
        editingProduct={editingProduct}
        submitting={savingProduct}
        error={productModalError}
        onClose={() => setProductModalOpen(false)}
        onSubmit={handleSaveProduct}
      />
    </div>
  );
};
