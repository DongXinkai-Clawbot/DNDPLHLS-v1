import React, { useMemo, useRef, useState } from 'react';

type VirtualListProps<T> = {
  items: T[];
  itemHeight: number;
  height: number;
  overscan?: number;
  className?: string;
  innerClassName?: string;
  getKey?: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
};

export const VirtualList = <T,>({
  items,
  itemHeight,
  height,
  overscan = 6,
  className,
  innerClassName,
  getKey,
  renderItem
}: VirtualListProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const totalHeight = items.length * itemHeight;

  const { startIndex, endIndex } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(height / itemHeight) + overscan * 2;
    const end = Math.min(items.length, start + visibleCount);
    return { startIndex: start, endIndex: end };
  }, [scrollTop, itemHeight, height, overscan, items.length]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, overflowY: 'auto' }}
      onScroll={handleScroll}
    >
      <div className={innerClassName} style={{ height: totalHeight, position: 'relative' }}>
        {items.slice(startIndex, endIndex).map((item, offset) => {
          const index = startIndex + offset;
          const key = getKey ? getKey(item, index) : String(index);
          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                top: index * itemHeight,
                left: 0,
                right: 0,
                height: itemHeight
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
