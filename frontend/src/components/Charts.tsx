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

export const HeatmapChart: React.FC<HeatmapChartProps> = ({ data, xAxis, yAxis }) => {
  // data format: [[x, y, value], ...]
  const formattedData = [];
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data[i].length; j++) {
      formattedData.push([j, i, data[i][j]]);
    }
  }

  const option = {
    tooltip: {
      position: 'top'
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
      min: 0,
      max: 3,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      show: false,
      inRange: {
        color: ['#f0fdf4', '#dcfce7', '#ffedd5', '#fee2e2'] // 对应低、中、高
      }
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
