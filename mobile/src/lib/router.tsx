import React, { createContext, useContext, useState, useEffect } from 'react';

interface NavigationContextType {
  pathname: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  outlet: React.ReactNode | null;
  setOutlet: (outlet: React.ReactNode | null) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [pathname, setPathname] = useState('/login');
  const [history, setHistory] = useState<string[]>(['/login']);
  const [outlet, setOutlet] = useState<React.ReactNode | null>(null);

  const navigate = (to: string | number, options?: { replace?: boolean }) => {
    if (typeof to === 'number') {
      if (to === -1 && history.length > 1) {
        const prev = history[history.length - 2];
        setPathname(prev);
        setHistory(h => h.slice(0, -1));
      }
      return;
    }
    
    if (typeof to !== 'string' || !to) return;
    
    let normalized = to;
    if (!to.startsWith('/')) {
      normalized = '/' + to;
    }

    setPathname(normalized);
    if (options?.replace) {
      setHistory(prev => [...prev.slice(0, -1), normalized]);
    } else {
      setHistory(prev => [...prev, normalized]);
    }
  };

  return (
    <NavigationContext.Provider value={{ pathname, navigate, outlet, setOutlet }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigate() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('useNavigate must be used within NavigationProvider');
  return context.navigate;
}

export function useLocation() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('useLocation must be used within NavigationProvider');
  return { pathname: context.pathname };
}

export function BrowserRouter({ children }: { children: React.ReactNode }) {
  return <NavigationProvider>{children}</NavigationProvider>;
}

interface RouteProps {
  path?: string;
  element: React.ReactNode;
  index?: boolean;
  children?: React.ReactNode;
}

export function Routes({ children }: { children: React.ReactNode }) {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('Routes must be used within NavigationProvider');

  const { pathname, navigate, setOutlet } = context;

  const routesArray = React.Children.toArray(children) as React.ReactElement<RouteProps>[];

  let matchedElement: React.ReactNode | null = null;
  let activeOutlet: React.ReactNode | null = null;

  const loginRoute = routesArray.find(r => r.props.path === '/login');
  const mainLayoutRoute = routesArray.find(r => r.props.path === '/');
  const wildcardRoute = routesArray.find(r => r.props.path === '*');

  if (pathname === '/login') {
    matchedElement = loginRoute ? loginRoute.props.element : null;
  } else if (pathname === '/' || pathname.startsWith('/')) {
    // Try to match a top-level route first (non-layout routes)
    const topLevelMatch = routesArray.find(r =>
      r.props.path && r.props.path !== '/' && r.props.path !== '*' && r.props.path !== '/login' &&
      pathname === r.props.path
    );

    if (topLevelMatch) {
      matchedElement = topLevelMatch.props.element;
    } else if (mainLayoutRoute) {
      matchedElement = mainLayoutRoute.props.element;

      if (mainLayoutRoute.props.children) {
        const subRoutes = React.Children.toArray(mainLayoutRoute.props.children) as React.ReactElement<RouteProps>[];
        // Strip leading slash for sub-path matching
        const currentSubPath = pathname.replace(/^\//, ''); // e.g. "home" from "/home"

        const matchedSub = subRoutes.find(r =>
          r.props.path === currentSubPath ||
          (r.props.index && (currentSubPath === '' || pathname === '/'))
        );

        if (matchedSub) {
          activeOutlet = matchedSub.props.element;
        } else {
          // Check for wildcard in sub-routes
          const subWildcard = subRoutes.find(r => r.props.path === '*');
          if (subWildcard) {
            activeOutlet = subWildcard.props.element;
          } else if (wildcardRoute) {
            // Top-level wildcard fallback
            matchedElement = wildcardRoute.props.element;
          }
        }
      }
    } else if (wildcardRoute) {
      matchedElement = wildcardRoute.props.element;
    }
  }

  useEffect(() => {
    setOutlet(activeOutlet);
  }, [activeOutlet, setOutlet]);

  return <>{matchedElement}</>;
}

export function Route({ element }: RouteProps) {
  return <>{element}</>;
}

export function Outlet() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('Outlet must be used within NavigationProvider');
  return <>{context.outlet}</>;
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [to, replace, navigate]);
  return null;
}
