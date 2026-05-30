import React from 'react';
import { TABLE_PASSIVES } from './data/DataTableData';

export const DataTable: React.FC = () => {
  return (
    <table className="wiki_table sortable searchable" style={{ width: '100%' }}>
      <thead>
        <tr>
          <th style={{ textAlign:'center' }}>Name</th>
          <th style={{ textAlign:'center' }}>Type</th>
          <th style={{ textAlign:'center' }}>Effect</th>
        </tr>
      </thead>
      <tbody>
        {TABLE_PASSIVES.map(row => (
          <tr key={row.id}>
            <td style={{ textAlign:'center' }}>{row.name}</td>
            <td style={{ textAlign:'center' }}>{row.type}</td>
            <td style={{ fontSize:'0.7rem' }}>{row.effect}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};