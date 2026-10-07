import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { HashRouter, Redirect, Route, Switch, useHistory, useLocation } from "react-router-dom";

import { isApiError } from "@/api/errors";
import { Layout } from "@/components/Layout";
import { isValidBuilderId } from "@/config";
import { BUILDER_ID_QUERY_PARAM, storeLinkBuilderId } from "@/context/attribution";
import { useWallet, WalletProvider } from "@/context/WalletContext";
import { DashboardPage } from "@/pages/Dashboard/DashboardPage";
import { ExplorerPage } from "@/pages/Explorer/ExplorerPage";
import { OverviewPage } from "@/pages/Overview/OverviewPage";
import { TradePage } from "@/pages/Trade/TradePage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx will not fix itself on retry; network and 5xx errors get one more try.
      retry: (failureCount, error) =>
        failureCount < 1 && !(isApiError(error) && error.status >= 400 && error.status < 500),
      refetchOnWindowFocus: false,
    },
  },
});

/** Captures a `#/trade?builderId=<uuid>` attribution link, stores it, and strips it from the URL. */
function BuilderLinkCapture() {
  const location = useLocation();
  const history = useHistory();
  const { setAttribution } = useWallet();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const builderId = params.get(BUILDER_ID_QUERY_PARAM);
    if (builderId === null) {
      return;
    }
    if (isValidBuilderId(builderId)) {
      storeLinkBuilderId(builderId);
      setAttribution({ builderId, source: "link" });
    }
    params.delete(BUILDER_ID_QUERY_PARAM);
    const search = params.toString();
    history.replace({ pathname: location.pathname, search: search ? `?${search}` : "" });
  }, [location.search, location.pathname, history, setAttribution]);

  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <HashRouter>
          <BuilderLinkCapture />
          <Layout>
            <Switch>
              <Route exact path="/" component={OverviewPage} />
              <Route path="/trade" component={TradePage} />
              <Route path="/builder" component={DashboardPage} />
              <Route path="/explorer/:endpointId?" component={ExplorerPage} />
              <Redirect to="/" />
            </Switch>
          </Layout>
        </HashRouter>
      </WalletProvider>
    </QueryClientProvider>
  );
}
