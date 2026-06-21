'use client';

import { useMarketDataStore } from '@/stores/chartStore';

export function OrderBookPanel() {
  const { orderBook, symbol } = useMarketDataStore();

  if (!orderBook) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs">
        Loading order book...
      </div>
    );
  }

  const maxBidQty = Math.max(...orderBook.bids.map(b => b.quantity), 0.001);
  const maxAskQty = Math.max(...orderBook.asks.map(a => a.quantity), 0.001);

  return (
    <div className="h-full flex flex-col">
      {/* Best bid/ask header */}
      <div className="grid grid-cols-2 gap-2 px-2 py-2 bg-surface-elevated/50">
        <div className="text-right">
          <div className="text-2xs text-text-muted">Bid</div>
          <div className="text-sm font-mono font-medium text-bull">
            {orderBook.bestBid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="text-left">
          <div className="text-2xs text-text-muted">Ask</div>
          <div className="text-sm font-mono font-medium text-bear">
            {orderBook.bestAsk.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
      
      {/* Spread */}
      <div className="text-center py-1 text-2xs text-text-muted border-b border-border">
        Spread: {orderBook.spread.toFixed(2)} ({((orderBook.spread / orderBook.bestBid) * 100).toFixed(3)}%)
      </div>

      {/* Order book rows */}
      <div className="flex-1 overflow-auto">
        {/* Asks (reversed so lowest ask is at bottom) */}
        <div className="flex flex-col-reverse">
          {orderBook.asks.map((level, i) => (
            <OrderBookRow
              key={`ask-${i}`}
              price={level.price}
              quantity={level.quantity}
              maxQuantity={maxAskQty}
              side="ask"
            />
          ))}
        </div>
        
        {/* Divider with mid price */}
        <div className="py-1 text-center bg-surface-elevated/30 border-y border-border">
          <span className="text-2xs text-text-muted">
            Mid: {((orderBook.bestBid + orderBook.bestAsk) / 2).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        
        {/* Bids */}
        <div className="flex flex-col">
          {orderBook.bids.map((level, i) => (
            <OrderBookRow
              key={`bid-${i}`}
              price={level.price}
              quantity={level.quantity}
              maxQuantity={maxBidQty}
              side="bid"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface OrderBookRowProps {
  price: number;
  quantity: number;
  maxQuantity: number;
  side: 'bid' | 'ask';
}

function OrderBookRow({ price, quantity, maxQuantity, side }: OrderBookRowProps) {
  const percentage = (quantity / maxQuantity) * 100;
  const bgColor = side === 'bid' ? 'bg-bull/10' : 'bg-bear/10';
  const textColor = side === 'bid' ? 'text-bull' : 'text-bear';

  return (
    <div className="relative grid grid-cols-2 gap-2 px-2 py-0.5 text-2xs hover:bg-surface-elevated transition-colors">
      {/* Background bar */}
      <div
        className={`absolute inset-y-0 ${side === 'bid' ? 'right-0' : 'left-0'} ${bgColor}`}
        style={{ width: `${percentage}%` }}
      />
      
      {/* Price */}
      <span className={`relative font-mono ${textColor}`}>
        {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      
      {/* Quantity */}
      <span className="relative text-right text-text-secondary font-mono">
        {quantity.toFixed(4)}
      </span>
    </div>
  );
}
