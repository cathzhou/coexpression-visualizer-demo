'use client';

import { ExpressionProfile } from '@/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ExpressionPlotProps {
  receptor: ExpressionProfile;
  ligand: ExpressionProfile;
}

export default function ExpressionPlot({ receptor, ligand }: ExpressionPlotProps) {
  // Process tissue data (maintain original order)
  const receptorTissueData = receptor.tissue_expression.map(item => ({
    name: item.name,
    value: item.value
  }));

  const ligandTissueData = ligand.tissue_expression.map(item => ({
    name: item.name,
    value: item.value
  }));

  // Process cell data (maintain original order)
  const receptorCellData = receptor.cell_expression.map(item => ({
    name: item.name,
    value: item.value
  }));

  const ligandCellData = ligand.cell_expression.map(item => ({
    name: item.name,
    value: item.value
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 rounded border border-gray-200 shadow-lg">
          <p className="text-gray-900 font-medium text-xs">{label}</p>
          <p className="text-gray-700 text-xs">
            {payload[0].value.toFixed(2)} nTPM
          </p>
        </div>
      );
    }
    return null;
  };

  const renderBarChart = (data: any[], title: string, color: string, isCell: boolean = false) => (
    <div className="h-[800px] bg-white rounded-lg shadow-md p-2">
      <h5 className="text-gray-900 font-medium mb-1 text-sm pl-32">{title}</h5>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            type="number"
            domain={[0, 'auto']}
            tick={{ fill: '#374151', fontSize: isCell ? 6 : 10 }}
            tickSize={4}
            tickMargin={2}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={isCell ? 100 : 120}
            tick={{ 
              fill: '#374151', 
              fontSize: isCell ? 6 : 10,
              textAnchor: 'end',
              width: isCell ? 90 : 110
            }}
            interval={0}
            tickMargin={0}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="value"
            fill={color}
            barSize={12}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="space-y-4 mx-[-1rem]">
      {/* Tissue Expression Plots */}
      <div>
        <h4 className="text-lg font-medium text-white mb-2 px-4">Tissue Expression</h4>
        <div className="grid grid-cols-2 gap-2">
          {renderBarChart(
            receptorTissueData,
            `${receptor.gene_name} Expression`,
            '#60A5FA',
            false
          )}
          {renderBarChart(
            ligandTissueData,
            `${ligand.gene_name} Expression`,
            '#34D399',
            false
          )}
        </div>
      </div>

      {/* Cell Type Expression Plots */}
      <div>
        <h4 className="text-lg font-medium text-white mb-2 px-4">Cell Type Expression</h4>
        <div className="grid grid-cols-2 gap-2">
          {renderBarChart(
            receptorCellData,
            `${receptor.gene_name} Expression`,
            '#60A5FA',
            true
          )}
          {renderBarChart(
            ligandCellData,
            `${ligand.gene_name} Expression`,
            '#34D399',
            true
          )}
        </div>
      </div>
    </div>
  );
} 