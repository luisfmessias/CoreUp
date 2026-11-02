"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useIncrementalList<T>(items: T[], resetKey: string, chunk = 30) {
  const [state, setState] = useState({ key: resetKey, count: chunk });
  const count = state.key === resetKey ? state.count : chunk;
  const observerRef = useRef<IntersectionObserver | null>(null);

  if (state.key !== resetKey) {
    setState({ key: resetKey, count: chunk });
  }

  const loadMore = useCallback(() => {
    setState((current) => ({ key: current.key, count: current.count + chunk }));
  }, [chunk]);

  const hasMore = count < items.length;

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();

      if (!node || !hasMore) {
        return;
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            loadMore();
          }
        },
        { rootMargin: "400px 0px" }
      );
      observerRef.current.observe(node);
    },
    [hasMore, loadMore]
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { visible: items.slice(0, count), hasMore, loadMore, sentinelRef, total: items.length };
}
