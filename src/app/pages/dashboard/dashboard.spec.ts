import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MarketService } from '../../core/market.service';
import { MarketState } from '../../core/market.types';
import { DEFAULT_SETTINGS } from '../../core/settings';
import { Dashboard } from './dashboard';

function createFakeMarketService(initialState: MarketState) {
  const stateSignal = signal(initialState);
  return {
    state: stateSignal.asReadonly(),
    pause: vi.fn(),
    resume: vi.fn(),
    setState: (next: MarketState) => stateSignal.set(next),
  };
}

function buildState(overrides: Partial<MarketState> = {}): MarketState {
  return {
    status: 'running',
    activeRunId: 1,
    settings: DEFAULT_SETTINGS,
    instruments: [
      {
        instrument: 'ALFA',
        lastPriceCents: 10200,
        spreadCents: 20,
        totalVolume: 40,
        vwapCents: 10150,
        imbalance: 0.2,
      },
      {
        instrument: 'BETA',
        lastPriceCents: null,
        spreadCents: null,
        totalVolume: 0,
        vwapCents: null,
        imbalance: null,
      },
    ],
    error: null,
    ...overrides,
  };
}

describe('Dashboard', () => {
  let fixture: ComponentFixture<Dashboard>;
  let fakeMarketService: ReturnType<typeof createFakeMarketService>;
  let host: HTMLElement;

  beforeEach(async () => {
    fakeMarketService = createFakeMarketService(buildState());

    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [{ provide: MarketService, useValue: fakeMarketService }],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    host = fixture.nativeElement as HTMLElement;
  });

  function setState(next: MarketState): void {
    fakeMarketService.setState(next);
    fixture.detectChanges();
  }

  function dataRows(): HTMLTableRowElement[] {
    return Array.from(host.querySelectorAll<HTMLTableRowElement>('tbody tr'));
  }

  function cellTexts(row: HTMLTableRowElement): string[] {
    return Array.from(row.querySelectorAll('td')).map((td) => td.textContent?.trim() ?? '');
  }

  function toggleButton(): HTMLButtonElement {
    const button = host.querySelector<HTMLButtonElement>('button');
    if (!button) throw new Error('Toggle button not rendered');
    return button;
  }

  it('renders instrument rows with correctly formatted values', () => {
    fixture.detectChanges();

    const rows = dataRows();
    expect(rows.length).toBe(2);

    const alfa = cellTexts(rows[0]);
    expect(alfa).toContain('ALFA');
    expect(alfa).toContain('$102.00');
    expect(alfa).toContain('$0.20');
    expect(alfa).toContain('40');
    expect(alfa).toContain('$101.50');
    expect(alfa).toContain('+0.20');
  });

  it('renders em dashes for an untraded instrument and 0 for its volume', () => {
    fixture.detectChanges();

    const beta = cellTexts(dataRows()[1]);
    expect(beta[0]).toBe('BETA');
    expect(beta[1]).toBe('—');
    expect(beta[2]).toBe('—');
    expect(beta[3]).toBe('0');
    expect(beta[4]).toBe('—');
    expect(beta[5]).toBe('—');
  });

  it('reflects the current status in the status bar', () => {
    fixture.detectChanges();
    expect(host.querySelector('.status')?.textContent).toContain('running');

    setState(buildState({ status: 'paused' }));
    expect(host.querySelector('.status')?.textContent).toContain('paused');
  });

  it('shows the loading indicator only while initializing', () => {
    setState(buildState({ status: 'initializing' }));
    expect(host.querySelector('.loading')).not.toBeNull();

    setState(buildState({ status: 'running' }));
    expect(host.querySelector('.loading')).toBeNull();
  });

  it('renders the error message only when an error is set', () => {
    setState(buildState({ status: 'error', error: 'wasm failed' }));
    expect(host.querySelector('.error-message')?.textContent).toContain('wasm failed');

    setState(buildState({ status: 'running', error: null }));
    expect(host.querySelector('.error-message')).toBeNull();
  });

  it('shows a Pause button while running and calls pause() on click', () => {
    fixture.detectChanges();

    const button = toggleButton();
    expect(button.textContent?.trim()).toBe('Pause');
    expect(button.disabled).toBe(false);

    button.click();
    fixture.detectChanges();

    expect(fakeMarketService.pause).toHaveBeenCalledTimes(1);
    expect(fakeMarketService.resume).not.toHaveBeenCalled();
  });

  it('shows a Resume button while paused and calls resume() on click', () => {
    setState(buildState({ status: 'paused' }));

    const button = toggleButton();
    expect(button.textContent?.trim()).toBe('Resume');

    button.click();
    fixture.detectChanges();

    expect(fakeMarketService.resume).toHaveBeenCalledTimes(1);
    expect(fakeMarketService.pause).not.toHaveBeenCalled();
  });

  it('disables the toggle button when neither running nor paused', () => {
    setState(buildState({ status: 'initializing' }));
    expect(toggleButton().disabled).toBe(true);

    setState(buildState({ status: 'error', error: 'boom' }));
    expect(toggleButton().disabled).toBe(true);
  });
});
