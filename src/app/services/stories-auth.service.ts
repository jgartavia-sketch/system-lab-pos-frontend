import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

export interface StoriesReader {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  referral_code: string;
  created_at: string;
}

export interface StoriesAuthResponse {
  access_token: string;
  token_type: string;
  reader: StoriesReader;
}

export interface ReferralSummary {
  referral_code: string;
  pending: number;
  confirmed: number;
  confirmed_toward_next_reward: number;
  referrals_needed_for_next_reward: number;
  available_rewards: number;
  total_rewards_earned: number;
  discount_percent_per_reward: number;
}

export interface StoriesDashboard {
  reader: StoriesReader;
  referrals: ReferralSummary;
  seasons: Array<{
    number: number;
    title: string;
    access: string;
    price_public: boolean;
    chapters: Array<{
      number: number;
      title: string;
      status: string;
      release_at: string | null;
      can_read: boolean;
      can_download_pdf: boolean;
    }>;
  }>;
}

@Injectable({ providedIn: 'root' })
export class StoriesAuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenKey = 'system_lab_stories_token';
  private readonly apiBase =
    (globalThis as typeof globalThis & { SYSTEM_LAB_API_URL?: string }).SYSTEM_LAB_API_URL
    ?? (globalThis.location?.hostname === 'localhost'
      ? 'http://localhost:8000'
      : 'https://system-lab-pos-backend.onrender.com');

  register(payload: { full_name: string; email: string; phone: string; password: string; referral_code?: string }): Observable<StoriesAuthResponse> {
    return this.http.post<StoriesAuthResponse>(`${this.apiBase}/stories/auth/register`, payload)
      .pipe(tap((response) => this.saveToken(response.access_token)));
  }

  login(payload: { email: string; password: string }): Observable<StoriesAuthResponse> {
    return this.http.post<StoriesAuthResponse>(`${this.apiBase}/stories/auth/login`, payload)
      .pipe(tap((response) => this.saveToken(response.access_token)));
  }

  getDashboard(): Observable<StoriesDashboard> {
    return this.http.get<StoriesDashboard>(`${this.apiBase}/stories/account`, { headers: this.authHeaders() });
  }

  hasSession(): boolean { return Boolean(globalThis.localStorage?.getItem(this.tokenKey)); }
  logout(): void { globalThis.localStorage?.removeItem(this.tokenKey); }
  private saveToken(token: string): void { globalThis.localStorage?.setItem(this.tokenKey, token); }
  private authHeaders(): HttpHeaders {
    const token = globalThis.localStorage?.getItem(this.tokenKey) ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
