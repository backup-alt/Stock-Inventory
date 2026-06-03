import { Component, NgZone, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnDestroy {
  private readonly fallbackRoute = '/tabs/dashboard';
  private readonly routeHistory: string[] = [];
  private backButtonSubscription?: Subscription;
  private routerSubscription: Subscription;

  constructor(
    private platform: Platform,
    private router: Router,
    private zone: NgZone
  ) {
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.recordRoute(event.urlAfterRedirects));

    this.platform.ready().then(() => {
      this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(9999, () => {
        this.zone.run(() => this.handleBackButton());
      });
    });
  }

  ngOnDestroy() {
    this.routerSubscription.unsubscribe();
    this.backButtonSubscription?.unsubscribe();
  }

  private recordRoute(url: string) {
    const cleanUrl = this.cleanRoute(url);
    const current = this.routeHistory[this.routeHistory.length - 1];

    if (cleanUrl !== current) {
      this.routeHistory.push(cleanUrl);
    }
  }

  private handleBackButton() {
    if (this.routeHistory.length > 1) {
      this.routeHistory.pop();
      const previousRoute = this.routeHistory[this.routeHistory.length - 1] || this.fallbackRoute;
      this.router.navigateByUrl(previousRoute, { replaceUrl: true });
      return;
    }

    if (this.cleanRoute(this.router.url) !== this.fallbackRoute) {
      this.router.navigateByUrl(this.fallbackRoute, { replaceUrl: true });
    }
  }

  private cleanRoute(url: string): string {
    return url.split('?')[0].split('#')[0] || this.fallbackRoute;
  }
}
