"use client";

import Image from "next/image";
import { Star, ShoppingCart, Scale, Truck } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
  originalPrice?: number;
  deliveryEstimate?: string;
  onAddToCart: (product: Product) => void;
  onCompare?: (product: Product) => void;
}

function calcDiscountPct(original: number, current: number): number {
  return Math.round(((original - current) / original) * 100);
}

export function ProductCard({
  product,
  originalPrice,
  deliveryEstimate,
  onAddToCart,
  onCompare,
}: ProductCardProps) {
  const hasDiscount =
    originalPrice !== undefined && originalPrice > product.price;
  const discountPct = hasDiscount
    ? calcDiscountPct(originalPrice!, product.price)
    : 0;
  const isOutOfStock = !product.inStock;

  return (
    <Card
      className="group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
      style={{
        backgroundColor: "var(--kapru-cream)",
        borderColor: "var(--kapru-teal-light)",
        borderWidth: "1px",
        boxShadow: "0 2px 8px 0 rgba(14,79,79,0.07)",
      }}
    >
      {/* ── Image area ──────────────────────────────────────────── */}
      <div className="relative w-full aspect-square overflow-hidden rounded-xl mx-0">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={`object-cover object-top transition-transform duration-300 group-hover:scale-105 ${
            isOutOfStock ? "opacity-60" : ""
          }`}
        />

        {/* Discount ribbon */}
        {hasDiscount && !isOutOfStock && (
          <span
            className="absolute top-2 left-2 z-10 px-2 py-0.5 text-xs font-semibold text-white rounded-full shadow-sm"
            style={{ backgroundColor: "var(--kapru-coral)" }}
          >
            {discountPct}% OFF
          </span>
        )}

        {/* Out of stock badge over image */}
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-black/60 text-white backdrop-blur-sm">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* ── Card body ───────────────────────────────────────────── */}
      <CardContent className="flex flex-col gap-2 pt-3 pb-0 flex-1">
        {/* Product name */}
        <h3
          className="font-semibold text-sm leading-snug line-clamp-2"
          style={{ color: "var(--kapru-ink)" }}
        >
          {product.name}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-1">
          <Star
            className="size-3.5 fill-current"
            style={{ color: "var(--kapru-gold)" }}
          />
          <span className="text-xs text-muted-foreground font-medium">
            {product.rating.toFixed(1)}
          </span>
        </div>

        {/* Price row — hidden when out of stock */}
        {!isOutOfStock && (
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className="text-lg font-bold leading-none"
              style={{ color: "var(--kapru-gold)" }}
            >
              Rs. {product.price.toLocaleString("en-US")}
            </span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">
                Rs. {originalPrice!.toLocaleString("en-US")}
              </span>
            )}
          </div>
        )}

        {/* Delivery estimate */}
        {deliveryEstimate && !isOutOfStock && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Truck className="size-3.5 shrink-0" />
            <span className="text-xs">{deliveryEstimate}</span>
          </div>
        )}
      </CardContent>

      {/* ── Footer — buttons ────────────────────────────────────── */}
      {!isOutOfStock && (
        <CardFooter className="flex gap-2 pt-3 border-none bg-transparent">
          <Button
            className="flex-1 gap-1.5 text-xs font-semibold text-white border-none"
            style={{
              backgroundColor: "var(--kapru-coral)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "#d04e3d";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "var(--kapru-coral)";
            }}
            onClick={() => onAddToCart(product)}
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingCart className="size-3.5" />
            Add to Cart
          </Button>

          {onCompare && (
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              style={{
                borderColor: "var(--kapru-teal-light)",
                color: "var(--kapru-teal)",
              }}
              onClick={() => onCompare(product)}
              aria-label={`Compare ${product.name}`}
            >
              <Scale className="size-4" />
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
