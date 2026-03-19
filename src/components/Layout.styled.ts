import styled from "styled-components";

export const LayoutWrapper = styled.div`
  display: flex;
  height: 100%;
`;

export const MainContent = styled.main`
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
`;

export const PageTitle = styled.h1`
  font-size: var(--font-size-xl);
  font-weight: 600;
  margin-bottom: var(--space-lg);
  color: var(--text-primary);
`;
