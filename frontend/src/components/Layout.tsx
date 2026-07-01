import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import ErrorBoundary from './ErrorBoundary';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <div className="app-layout">
      <ErrorBoundary sectionName="Header" compact>
        <Header
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />
      </ErrorBoundary>
      <div className="app-body">
        <ErrorBoundary sectionName="Sidebar" compact>
          <Sidebar isOpen={sidebarOpen} />
        </ErrorBoundary>
        <main className="app-content">
          <ErrorBoundary sectionName="Main dashboard panel">
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default Layout;
