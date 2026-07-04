import React from 'react';

const Pagination = ({ currentPage, totalPages, totalItems, limit, onPageChange }) => {
  if (totalPages <= 1) return null;

  // Calculate the range of items being shown
  const startItem = ((currentPage - 1) * limit) + 1;
  const endItem = Math.min(currentPage * limit, totalItems);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 3) {
      for (let i = 1; i <= 5; i++) pages.push(i);
    } else if (currentPage >= totalPages - 2) {
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
    }
    return pages;
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '16px 0',
      borderTop: '1px solid #e2e8f0',
      marginTop: '16px',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      <div style={{ color: '#4a5568', fontSize: '14px' }}>
        Showing {startItem} - {endItem} of {totalItems} items
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          style={{
            padding: '6px 14px',
            background: currentPage === 1 ? '#e2e8f0' : '#0f3460',
            color: currentPage === 1 ? '#a0aec0' : 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: '600'
          }}
        >
          Previous
        </button>
        
        {getPageNumbers().map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            style={{
              padding: '6px 12px',
              minWidth: '36px',
              background: currentPage === pageNum ? '#0f3460' : 'white',
              color: currentPage === pageNum ? 'white' : '#4a5568',
              border: currentPage === pageNum ? 'none' : '1px solid #e2e8f0',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: currentPage === pageNum ? '700' : '500',
              fontSize: '13px'
            }}
          >
            {pageNum}
          </button>
        ))}

        <button 
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          style={{
            padding: '6px 14px',
            background: currentPage === totalPages ? '#e2e8f0' : '#0f3460',
            color: currentPage === totalPages ? '#a0aec0' : 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: '600'
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Pagination;

