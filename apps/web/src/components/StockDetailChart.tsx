import { useEffect, useRef } from "react";

import {
  type BusinessDay,
  CandlestickSeries,
  createChart,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type LogicalRange,
  type Time,
} from "lightweight-charts";

import type { StockDetailChartData, StockDetailChartVisibility } from "../data/stockDetailData";

function isBusinessDay(value: Time): value is BusinessDay {
  return typeof value === "object" && value !== null && "year" in value;
}

function toDate(value: Time): Date {
  if (isBusinessDay(value)) {
    return new Date(Date.UTC(value.year, value.month - 1, value.day));
  }

  if (typeof value === "number") {
    return new Date(value * 1000);
  }

  return new Date(value);
}

function formatDetailDate(value: Time): string {
  const date = toDate(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function StockDetailChart({
  chartData,
  visibility,
}: {
  chartData: StockDetailChartData;
  visibility: StockDetailChartVisibility;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const visibleLogicalRangeRef = useRef<LogicalRange | null>(null);

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
      height: 520,
      layout: {
        background: {
          color: "#ffffff",
        },
        textColor: "#3f3f46",
      },
      localization: {
        locale: "ja-JP",
        timeFormatter: formatDetailDate,
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
        top: 0.18,
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
    const ichimokuConversionSeries = chart.addSeries(LineSeries, {
      color: "#2563eb",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      lineWidth: 1,
      priceLineVisible: false,
      visible: visibility.ichimoku,
    });
    const ichimokuBaseSeries = chart.addSeries(LineSeries, {
      color: "#7c3aed",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      lineWidth: 1,
      priceLineVisible: false,
      visible: visibility.ichimoku,
    });
    const ichimokuSpanASeries = chart.addSeries(LineSeries, {
      color: "#16a34a",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      priceLineVisible: false,
      visible: visibility.ichimoku,
    });
    const ichimokuSpanBSeries = chart.addSeries(LineSeries, {
      color: "#dc2626",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      priceLineVisible: false,
      visible: visibility.ichimoku,
    });
    const bollingerUpperSeries = chart.addSeries(LineSeries, {
      color: "#6366f1",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      lineWidth: 1,
      priceLineVisible: false,
      visible: visibility.bollinger,
    });
    const bollingerMiddleSeries = chart.addSeries(LineSeries, {
      color: "#818cf8",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      priceLineVisible: false,
      visible: visibility.bollinger,
    });
    const bollingerLowerSeries = chart.addSeries(LineSeries, {
      color: "#6366f1",
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      lineWidth: 1,
      priceLineVisible: false,
      visible: visibility.bollinger,
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

    let nextPaneIndex = 1;
    let rsiPaneIndex: number | null = null;
    let macdPaneIndex: number | null = null;
    let stochasticPaneIndex: number | null = null;

    if (visibility.rsi) {
      rsiPaneIndex = nextPaneIndex;
      nextPaneIndex += 1;
    }

    if (visibility.stochastic) {
      stochasticPaneIndex = nextPaneIndex;
      nextPaneIndex += 1;
    }

    if (visibility.macd) {
      macdPaneIndex = nextPaneIndex;
    }

    const rsiSeries =
      rsiPaneIndex !== null
        ? chart.addSeries(
            LineSeries,
            {
              color: "#9333ea",
              crosshairMarkerVisible: false,
              lastValueVisible: false,
              lineWidth: 2,
              priceLineVisible: false,
            },
            rsiPaneIndex,
          )
        : null;
    const rsiUpperSeries =
      rsiPaneIndex !== null
        ? chart.addSeries(
            LineSeries,
            {
              color: "#a1a1aa",
              crosshairMarkerVisible: false,
              lastValueVisible: false,
              lineStyle: LineStyle.Dashed,
              lineWidth: 1,
              priceLineVisible: false,
            },
            rsiPaneIndex,
          )
        : null;
    const rsiLowerSeries =
      rsiPaneIndex !== null
        ? chart.addSeries(
            LineSeries,
            {
              color: "#a1a1aa",
              crosshairMarkerVisible: false,
              lastValueVisible: false,
              lineStyle: LineStyle.Dashed,
              lineWidth: 1,
              priceLineVisible: false,
            },
            rsiPaneIndex,
          )
        : null;
    const macdSeries =
      macdPaneIndex !== null
        ? chart.addSeries(
            LineSeries,
            {
              color: "#2563eb",
              crosshairMarkerVisible: false,
              lastValueVisible: false,
              lineWidth: 2,
              priceLineVisible: false,
            },
            macdPaneIndex,
          )
        : null;
    const macdSignalSeries =
      macdPaneIndex !== null
        ? chart.addSeries(
            LineSeries,
            {
              color: "#f97316",
              crosshairMarkerVisible: false,
              lastValueVisible: false,
              lineWidth: 2,
              priceLineVisible: false,
            },
            macdPaneIndex,
          )
        : null;
    const macdHistogramSeries =
      macdPaneIndex !== null
        ? chart.addSeries(
            HistogramSeries,
            {
              priceLineVisible: false,
            },
            macdPaneIndex,
          )
        : null;
    const stochasticKSeries =
      stochasticPaneIndex !== null
        ? chart.addSeries(
            LineSeries,
            {
              color: "#0f766e",
              crosshairMarkerVisible: false,
              lastValueVisible: false,
              lineWidth: 2,
              priceLineVisible: false,
            },
            stochasticPaneIndex,
          )
        : null;
    const stochasticDSeries =
      stochasticPaneIndex !== null
        ? chart.addSeries(
            LineSeries,
            {
              color: "#d97706",
              crosshairMarkerVisible: false,
              lastValueVisible: false,
              lineWidth: 2,
              priceLineVisible: false,
            },
            stochasticPaneIndex,
          )
        : null;
    const stochasticUpperSeries =
      stochasticPaneIndex !== null
        ? chart.addSeries(
            LineSeries,
            {
              color: "#a1a1aa",
              crosshairMarkerVisible: false,
              lastValueVisible: false,
              lineStyle: LineStyle.Dashed,
              lineWidth: 1,
              priceLineVisible: false,
            },
            stochasticPaneIndex,
          )
        : null;
    const stochasticLowerSeries =
      stochasticPaneIndex !== null
        ? chart.addSeries(
            LineSeries,
            {
              color: "#a1a1aa",
              crosshairMarkerVisible: false,
              lastValueVisible: false,
              lineStyle: LineStyle.Dashed,
              lineWidth: 1,
              priceLineVisible: false,
            },
            stochasticPaneIndex,
          )
        : null;

    candleSeries.setData(chartData.candlesticks);
    volumeSeries.setData(chartData.volume);
    ma25Series.setData(chartData.ma25);
    ma75Series.setData(chartData.ma75);
    ichimokuConversionSeries.setData(chartData.ichimokuConversion);
    ichimokuBaseSeries.setData(chartData.ichimokuBase);
    ichimokuSpanASeries.setData(chartData.ichimokuSpanA);
    ichimokuSpanBSeries.setData(chartData.ichimokuSpanB);
    bollingerUpperSeries.setData(chartData.bollingerUpper);
    bollingerMiddleSeries.setData(chartData.bollingerMiddle);
    bollingerLowerSeries.setData(chartData.bollingerLower);
    recentHighSeries.setData(chartData.recentHigh ?? []);
    buyPriceSeries.setData(chartData.buyPrice ?? []);
    stopLossSeries.setData(chartData.stopLoss ?? []);

    if (rsiSeries && rsiUpperSeries && rsiLowerSeries && rsiPaneIndex !== null) {
      rsiSeries.setData(chartData.rsi);
      rsiUpperSeries.setData(chartData.rsiUpperBand);
      rsiLowerSeries.setData(chartData.rsiLowerBand);
      chart.priceScale("right", rsiPaneIndex).applyOptions({
        autoScale: true,
        borderColor: "#d4d4d8",
        scaleMargins: {
          bottom: 0.1,
          top: 0.1,
        },
      });
    }

    if (macdSeries && macdSignalSeries && macdHistogramSeries && macdPaneIndex !== null) {
      macdSeries.setData(chartData.macdLine);
      macdSignalSeries.setData(chartData.macdSignal);
      macdHistogramSeries.setData(chartData.macdHistogram);
      chart.priceScale("right", macdPaneIndex).applyOptions({
        autoScale: true,
        borderColor: "#d4d4d8",
        scaleMargins: {
          bottom: 0.15,
          top: 0.15,
        },
      });
    }

    if (
      stochasticKSeries &&
      stochasticDSeries &&
      stochasticUpperSeries &&
      stochasticLowerSeries &&
      stochasticPaneIndex !== null
    ) {
      stochasticKSeries.setData(chartData.stochasticK);
      stochasticDSeries.setData(chartData.stochasticD);
      stochasticUpperSeries.setData(chartData.stochasticUpperBand);
      stochasticLowerSeries.setData(chartData.stochasticLowerBand);
      chart.priceScale("right", stochasticPaneIndex).applyOptions({
        autoScale: true,
        borderColor: "#d4d4d8",
        scaleMargins: {
          bottom: 0.1,
          top: 0.1,
        },
      });
    }

    const panes = chart.panes();
    panes[0]?.setStretchFactor(0.65);
    if (rsiPaneIndex !== null) {
      panes[rsiPaneIndex]?.setStretchFactor(macdPaneIndex !== null ? 0.18 : 0.25);
    }
    if (macdPaneIndex !== null) {
      panes[macdPaneIndex]?.setStretchFactor(rsiPaneIndex !== null ? 0.17 : 0.25);
    }
    if (stochasticPaneIndex !== null) {
      panes[stochasticPaneIndex]?.setStretchFactor(0.18);
    }

    if (visibleLogicalRangeRef.current) {
      chart.timeScale().setVisibleLogicalRange(visibleLogicalRangeRef.current);
    } else {
      chart.timeScale().fitContent();
    }

    const handleVisibleRangeChange = (range: LogicalRange | null) => {
      visibleLogicalRangeRef.current = range;
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      chart.resize(entry.contentRect.width, 520);
    });

    resizeObserver.observe(container);

    return () => {
      visibleLogicalRangeRef.current = chart.timeScale().getVisibleLogicalRange();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [chartData, visibility]);

  return <div className="min-h-[520px] w-full" ref={containerRef} />;
}
