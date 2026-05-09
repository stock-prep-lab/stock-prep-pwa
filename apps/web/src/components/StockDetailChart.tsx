import { useEffect, useRef } from "react";

import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  LineSeries,
  LineStyle,
} from "lightweight-charts";

import type { StockDetailChartData, StockDetailChartVisibility } from "../data/stockDetailData";

export function StockDetailChart({
  chartData,
  visibility,
}: {
  chartData: StockDetailChartData;
  visibility: StockDetailChartVisibility;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const chart = createChart(container, {
      grid: {
        horzLines: {
          color: "#e4e4e7",
        },
        vertLines: {
          color: "#f4f4f5",
        },
      },
      height: 360,
      layout: {
        background: {
          color: "#ffffff",
        },
        textColor: "#3f3f46",
      },
      localization: {
        locale: "ja-JP",
      },
      rightPriceScale: {
        borderColor: "#d4d4d8",
      },
      timeScale: {
        borderColor: "#d4d4d8",
      },
      width: container.clientWidth,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      borderVisible: false,
      borderDownColor: "#d97706",
      borderUpColor: "#0f766e",
      downColor: "#d97706",
      priceLineVisible: false,
      upColor: "#0f766e",
      wickColor: "#737373",
      wickVisible: true,
      wickDownColor: "#d97706",
      wickUpColor: "#0f766e",
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceLineVisible: false,
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        bottom: 0,
        top: 0.78,
      },
    });

    chart.priceScale("right").applyOptions({
      scaleMargins: {
        bottom: 0.24,
        top: 0.08,
      },
    });

    const ma25Series = chart.addSeries(LineSeries, {
      color: "#0f766e",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      lineWidth: 2,
      priceLineVisible: false,
      visible: visibility.ma25,
    });
    const ma75Series = chart.addSeries(LineSeries, {
      color: "#d97706",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      lineWidth: 2,
      priceLineVisible: false,
      visible: visibility.ma75,
    });
    const recentHighSeries = chart.addSeries(LineSeries, {
      color: "#52525b",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      priceLineVisible: false,
      visible: visibility.recentHigh,
    });
    const buyPriceSeries = chart.addSeries(LineSeries, {
      color: "#2563eb",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      lineStyle: LineStyle.Dotted,
      lineWidth: 2,
      priceLineVisible: false,
      visible: visibility.buyPrice,
    });
    const stopLossSeries = chart.addSeries(LineSeries, {
      color: "#dc2626",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      lineStyle: LineStyle.Dotted,
      lineWidth: 2,
      priceLineVisible: false,
      visible: visibility.stopLoss,
    });

    candleSeries.setData(chartData.candlesticks);
    volumeSeries.setData(chartData.volume);
    ma25Series.setData(chartData.ma25);
    ma75Series.setData(chartData.ma75);
    recentHighSeries.setData(chartData.recentHigh ?? []);
    buyPriceSeries.setData(chartData.buyPrice ?? []);
    stopLossSeries.setData(chartData.stopLoss ?? []);
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      chart.resize(entry.contentRect.width, 360);
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [chartData, visibility]);

  return <div className="min-h-80 w-full" ref={containerRef} />;
}
