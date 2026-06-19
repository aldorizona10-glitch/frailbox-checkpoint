import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import Header from './Header';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <div className="app-layout">
      <ErrorBoundary
        title="Header unavailable"
        message="Navigation controls are temporarily unavailable."
      >
        <Header
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />
      </ErrorBoundary>
      <div className="app-body">
        <ErrorBoundary
          title="Sidebar unavailable"
          message="Secondary navigation is temporarily unavailable."
        >
          <Sidebar isOpen={sidebarOpen} />
        </ErrorBoundary>
        <main className="app-content">
          <ErrorBoundary
            title="Content unavailable"
            message="The selected workspace could not be rendered."
          >
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default Layout;
