import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { MarketService, WORKER_FACTORY, WorkerLike } from './core/market.service';
import { routes } from './app.routes';

function createFakeWorker(): WorkerLike {
  return {
    postMessage: () => {},
    onmessage: null,
    onerror: null,
  };
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: WORKER_FACTORY, useValue: () => createFakeWorker() },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should call MarketService.init() on construction', () => {
    const postMessage = vi.fn();
    const fakeWorker: WorkerLike = {
      postMessage,
      onmessage: null,
      onerror: null,
    };

    TestBed.overrideProvider(WORKER_FACTORY, { useValue: () => fakeWorker });
    TestBed.createComponent(App);

    expect(postMessage).toHaveBeenCalledWith({ type: 'INIT' });
  });

  it('should render the navigation links', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Realtime Fintech Dashboard');
    expect(compiled.querySelectorAll('nav a').length).toBe(2);
  });
});
