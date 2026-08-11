import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";
import type { SellerProfile } from "../core/model";
import type { LicenseInfo } from "../core/license";
import { verifyLicenseKey } from "../core/license";
import { countFinalized, getSeller, kvGet } from "../core/db";
import { LICENSE_PUBLIC_JWK } from "../config";

export interface AppState {
  ready: boolean;
  seller: SellerProfile | undefined;
  licenseInfo: LicenseInfo | null;
  finalizedCount: number;
  demoMode: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AppState>({
  ready: false,
  seller: undefined,
  licenseInfo: null,
  finalizedCount: 0,
  demoMode: false,
  refresh: async () => {}
});

export function AppStateProvider(props: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AppState, "refresh">>({
    ready: false,
    seller: undefined,
    licenseInfo: null,
    finalizedCount: 0,
    demoMode: false
  });

  const refresh = useCallback(async () => {
    const [seller, licenseKey, count, demoMode] = await Promise.all([
      getSeller(),
      kvGet<string>("license"),
      countFinalized(),
      kvGet<boolean>("demoMode")
    ]);
    let licenseInfo: LicenseInfo | null = null;
    if (licenseKey) {
      licenseInfo = await verifyLicenseKey(licenseKey, LICENSE_PUBLIC_JWK);
    }
    setState({
      ready: true,
      seller,
      licenseInfo,
      finalizedCount: count,
      demoMode: Boolean(demoMode)
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <Ctx.Provider value={{ ...state, refresh }}>{props.children}</Ctx.Provider>;
}

export function useApp(): AppState {
  return useContext(Ctx);
}
