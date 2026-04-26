import React from 'react';
import ReactECharts from 'echarts-for-react';

interface RadarChartProps {
  data: number[];
  indicators: { name: string; max: number }[];
}

export const RadarChart: React.FC<RadarChartProps> = ({ data, indicators }) => {
  const option = {
    radar: {
      indicator: indicators,
      shape: 'polygon',
      splitNumber: 5,
      axisName: {
        color: '#999',
        fontSize: 10
      },
      splitLine: {
        lineStyle: {
          color: '#eee'
        }
      },
      splitArea: {
        show: false
      },
      axisLine: {
        lineStyle: {
          color: '#eee'
        }
      }
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: data,
            name: '画像摘要',
            symbol: 'none',
            itemStyle: {
              color: '#3b82f6'
            },
            areaStyle: {
              color: 'rgba(59, 130, 246, 0.2)'
            },
            lineStyle: {
              width: 2
            }
          }
        ]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};

interface HeatmapChartProps {
  data: number[][];
  xAxis: string[];
  yAxis: string[];
}

/** 与后端 conflict_agent 一致：0–3 为档位；>3 视为 0–100 压力分档映射到 0–3 */
function heatmapCellTier(raw: number): number {
  const n = Number(raw);
  if (Number.isNaN(n)) return 0;
  if (n <= 3) return Math.max(0, Math.min(3, Math.round(n)));
  return Math.max(0, Math.min(3, Math.floor((n + 32) / 33)));
}

export const HeatmapChart: React.FC<HeatmapChartProps> = ({ data, xAxis, yAxis }) => {
  // ECharts 第三维用归一化档位，颜色与 0–3 visualMap 一致
  const formattedData: [number, number, number][] = [];
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data[i].length; j++) {
      formattedData.push([j, i, heatmapCellTier(data[i][j])]);
    }
  }

  const option = {
    tooltip: {
      position: 'top',
      formatter: (params: any) => {
        const tier = params.data[2] as number;
        const member = xAxis[params.data[0]] ?? '';
        return `${member}：${tier}`;
      }
    },
    grid: {
      top: '10%',
      bottom: '15%',
      left: '15%',
      right: '5%'
    },
    xAxis: {
      type: 'category',
      data: xAxis,
      splitArea: {
        show: true
      },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'category',
      data: yAxis,
      splitArea: {
        show: true
      },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    visualMap: {
      type: 'piecewise',
      pieces: [
        { value: 0, color: '#f8fafc', label: '无' },   // slate-50 近白
        { value: 1, color: '#fecaca', label: '低' },   // red-200
        { value: 2, color: '#f87171', label: '中' },   // red-400
        { value: 3, color: '#dc2626', label: '高' }    // red-600
      ],
      show: false
    },
    series: [
      {
        name: '冲突强度',
        type: 'heatmap',
        data: formattedData,
        label: {
          show: false
        },
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
};
