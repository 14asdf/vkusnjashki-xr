import styled from 'styled-components';

type TButtonProps = {
  $variant?: 'disabled' | 'secondary';
  $fullWidth?: boolean;
};

export const Button = styled.button<TButtonProps>`
  width: ${(props) => (props.$fullWidth ? '100%' : 'auto')};
  padding: 12px 24px;
  font-size: 14px;
  font-weight: bold;
  border-radius: 5px;
  cursor: ${(props) =>
    props.$variant === 'disabled' ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;

  ${(props) => {
    switch (props.$variant) {
      case 'disabled':
        return /*css*/ `
          background-color: #666666;
          color: white;
          border: none;
          opacity: 0.5;
          cursor: not-allowed;
        `;
      case 'secondary':
        return /*css*/ `
          background: none;
          color: white;
          border: 1px solid #fff;
          
          &:hover {
            background-color: rgba(255, 255, 255, 0.1);
          }
        `;
      default:
        return /*css*/ `
          background: none;
          color: white;
          border: 1px solid #fff;
          &:hover {
            background-color: rgba(255, 255, 255, 0.1);
          }
        `;
    }
  }}

  &:active {
    transform: ${(props) =>
      props.$variant !== 'disabled' ? 'scale(0.98)' : 'none'};
  }
`;
