import { RequestHandler, Request, Response, NextFunction } from 'express';

export function expressGAuth(options: GauthOptions): RequestHandler;

export interface GauthOptions {
  readonly clientID: string;
  readonly clientSecret: string;
  readonly clientDomain: string;

  readonly allowedDomains?: ReadonlyArray<string>;
  readonly allowedEmails?: ReadonlyArray<string>;
  readonly publicEndPoints?: ReadonlyArray<string>;
  readonly logger?: { log: (...output: any[]) => void, error: (...output: any[]) => void };
  readonly unauthorizedUser?: (req: Request, res: Response, next: NextFunction, user: unknown) => void;
  readonly errorPassportAuth?: (req: Request, res: Response, next: NextFunction, err) => void;
  readonly errorNoUser?: (req: Request, res: Response, next: NextFunction) => void;
  readonly errorLogin?: (req: Request, res: Response, next: NextFunction, err: unknown) => void;
  readonly serializeUser?: (user: unknown, done: DoneCallback<unknown>) => void;
  readonly deserializeUser?: (user: unknown, done: DoneCallback<unknown>) => void;
  readonly returnToOriginalUrl?: boolean;
  readonly isReturnUrlAllowed?: (url: string) => boolean;
  readonly googleAuthorizationParams?: {
    readonly scope?: ReadonlyArray<string>;
    readonly prompt?: 'none' | 'consent' | 'select_account';
    readonly accessType?: 'offline' | 'online';
    readonly hostedDomain?: string;
    readonly loginHint?: string;
    readonly includeGrantedScopes?: boolean;
  },
  readonly refreshBefore?: number;
}

export type DoneCallback<T> =
  | ((err: unknown) => void)
  | ((err: null, value: T) => void);
