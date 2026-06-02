import { Component, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { IonTabs } from '@ionic/angular';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { DataService } from '../core/services/data.service';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  fragment?: string;
}

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage implements OnDestroy {
  @ViewChild('tabs') tabs!: IonTabs;

  readonly appName = 'LedgerFlow';
  activePrimaryIndex = 0;
  activeSideIndex = 2;
  drawerOpen = false;
  isDesktop = false;
  showPrintOptions = false;
  showSavedPdfAction = false;
  printStatusMessage = '';
  inputFocused = false;
  viewportKeyboardOpen = false;
  private apiBaseUrl = environment.apiBaseUrl.replace(/\/$/, '');
  private apiKey = environment.apiKey;
  private routerSubscription: Subscription;
  private initialViewportHeight = window.visualViewport?.height ?? window.innerHeight;
  private visualViewportResizeHandler = () => this.handleViewportResize();

  primaryNavItems: NavItem[] = [
    { icon: 'dashboard', label: 'Dashboard', route: 'dashboard' },
    { icon: 'assessment', label: 'Reports', route: 'overall-report' },
    { icon: 'inventory_2', label: 'Stock', route: 'stock-report' },
    { icon: 'info', label: 'Products', route: 'product-info' },
  ];

  sideNavItems: NavItem[] = [
    { icon: 'factory', label: 'Production Details', route: 'production-log' },
    { icon: 'inventory', label: 'Product Inventory Details', route: 'product-info', fragment: 'inventory-details' },
    { icon: 'dashboard', label: 'Dashboard', route: 'dashboard' },
  ];

  constructor(
    private router: Router,
    private zone: NgZone,
    private dataService: DataService
  ) {
    this.checkScreenSize();
    this.syncActiveTab(this.router.url);
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.syncActiveTab(event.urlAfterRedirects));
    window.visualViewport?.addEventListener('resize', this.visualViewportResizeHandler);
  }

  ngOnDestroy() {
    this.routerSubscription.unsubscribe();
    window.visualViewport?.removeEventListener('resize', this.visualViewportResizeHandler);
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  @HostListener('document:focusin', ['$event'])
  onDocumentFocusIn(event: FocusEvent) {
    this.inputFocused = this.isEditableElement(event.target);
  }

  @HostListener('document:focusout')
  onDocumentFocusOut() {
    setTimeout(() => {
      this.inputFocused = this.isEditableElement(document.activeElement);
    }, 120);
  }

  get keyboardActive(): boolean {
    return !this.isDesktop && (this.inputFocused || this.viewportKeyboardOpen);
  }

  checkScreenSize() {
    this.isDesktop = window.innerWidth >= 768;
    this.drawerOpen = this.isDesktop;
  }

  private handleViewportResize() {
    const viewport = window.visualViewport;

    if (!viewport) {
      return;
    }

    this.zone.run(() => {
      this.viewportKeyboardOpen = !this.isDesktop && this.initialViewportHeight - viewport.height > 140;
    });
  }

  private isEditableElement(target: EventTarget | Element | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  }

  toggleDrawer() {
    this.drawerOpen = !this.drawerOpen;
  }

  navigatePrimary(index: number) {
    this.activePrimaryIndex = index;
    const route = this.primaryNavItems[index].route;
    this.router.navigate(['/tabs', route]);
  }

  navigateSide(index: number) {
    this.activeSideIndex = index;
    const item = this.sideNavItems[index];
    this.router.navigate(['/tabs', item.route], { fragment: item.fragment }).then(() => {
      if (item.fragment) {
        setTimeout(() => document.getElementById(item.fragment ?? '')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    });
    if (!this.isDesktop) {
      this.drawerOpen = false;
    }
  }

  onTabChange(event: any) {
    const tabName = this.tabs.getSelected();
    const index = this.primaryNavItems.findIndex(item => item.route === tabName);
    if (index !== -1) {
      this.activePrimaryIndex = index;
    }
  }

  private syncActiveTab(url: string) {
    const [pathWithQuery, fragment = ''] = url.split('#');
    const cleanUrl = pathWithQuery.split('?')[0];

    if (cleanUrl.startsWith('/tabs/dashboard')) {
      this.activePrimaryIndex = this.primaryNavItems.findIndex(item => item.route === 'dashboard');
      this.activeSideIndex = this.sideNavItems.findIndex(item => item.route === 'dashboard');
      return;
    }

    if (cleanUrl.startsWith('/tabs/production-log')) {
      this.activePrimaryIndex = this.primaryNavItems.findIndex(item => item.route === 'overall-report');
      this.activeSideIndex = this.sideNavItems.findIndex(item => item.route === 'production-log');
      return;
    }

    if (cleanUrl.startsWith('/tabs/overall-report') || cleanUrl.startsWith('/tabs/recent-entries')) {
      this.activePrimaryIndex = this.primaryNavItems.findIndex(item => item.route === 'overall-report');
      this.activeSideIndex = -1;
      return;
    }

    if (cleanUrl.startsWith('/tabs/stock-report') || cleanUrl.startsWith('/tabs/inventory')) {
      this.activePrimaryIndex = this.primaryNavItems.findIndex(item => item.route === 'stock-report');
      this.activeSideIndex = -1;
      return;
    }

    if (cleanUrl.startsWith('/tabs/product-info')) {
      this.activePrimaryIndex = this.primaryNavItems.findIndex(item => item.route === 'product-info');
      this.activeSideIndex = this.sideNavItems.findIndex(item =>
        item.route === 'product-info' && (fragment === 'inventory-details' ? item.fragment === fragment : !item.fragment)
      );
    }
  }

  openPrintOptions() {
    this.printStatusMessage = '';
    this.showPrintOptions = true;
  }

  closePrintOptions() {
    this.showPrintOptions = false;
  }

  async savePdf() {
    const reportPayload = await this.createReportPayload();
    const { blob, fileName } = this.createCurrentPagePdf(reportPayload);
    const nativeBridge = (window as any).LedgerFlowPdfBridge;

    if (nativeBridge?.savePdf) {
      try {
        const result = nativeBridge.savePdf(await this.blobToDataUrl(blob), fileName);
        if (String(result).startsWith('OK')) {
          this.printStatusMessage = 'PDF saved to Downloads/LedgerFlow.';
          this.showSavedPdfAction = true;
          return;
        }
      } catch {
        this.printStatusMessage = 'Native PDF save failed. Trying browser download instead.';
      }
    } else if (nativeBridge?.saveReport) {
      try {
        const result = nativeBridge.saveReport(JSON.stringify(reportPayload), fileName);
        if (String(result).startsWith('OK')) {
          this.printStatusMessage = 'PDF saved to Downloads/LedgerFlow.';
          this.showSavedPdfAction = true;
          return;
        }
        this.printStatusMessage = 'Native PDF save failed. Trying browser download instead.';
      } catch {
        this.printStatusMessage = 'Native PDF save failed. Trying browser download instead.';
      }
    }

    this.downloadPdf(blob, fileName);
    this.printStatusMessage = 'Browser download started.';
  }

  async sharePdf() {
    const reportPayload = await this.createReportPayload();
    const { blob, fileName } = this.createCurrentPagePdf(reportPayload);
    const nativeBridge = (window as any).LedgerFlowPdfBridge;

    if (nativeBridge?.sharePdf) {
      try {
        const result = nativeBridge.sharePdf(await this.blobToDataUrl(blob), fileName);
        if (String(result).startsWith('OK')) {
          this.showPrintOptions = false;
          return;
        }
      } catch {
        this.printStatusMessage = 'Native PDF share failed. Trying browser share instead.';
      }
    } else if (nativeBridge?.shareReport) {
      try {
        const result = nativeBridge.shareReport(JSON.stringify(reportPayload), fileName);
        if (String(result).startsWith('OK')) {
          this.showPrintOptions = false;
          return;
        }
        this.printStatusMessage = 'Native PDF share failed. Trying browser share instead.';
      } catch {
        this.printStatusMessage = 'Native PDF share failed. Trying browser share instead.';
      }
    }

    const file = new File([blob], fileName, { type: 'application/pdf' });
    const shareData = {
      title: `${this.appName} report`,
      text: `Sharing ${this.appName} PDF report.`,
      files: [file],
    };
    const nav = navigator as any;

    try {
      if (nav.share && (!nav.canShare || nav.canShare(shareData))) {
        await nav.share(shareData);
        this.showPrintOptions = false;
        return;
      }

      this.downloadPdf(blob, fileName);
      this.showPrintOptions = false;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
      this.printStatusMessage = 'Sharing is not available here, so use Save PDF instead.';
    }
  }

  openSavedPdf() {
    const nativeBridge = (window as any).LedgerFlowPdfBridge;

    if (nativeBridge?.openLastSavedPdf) {
      const result = nativeBridge.openLastSavedPdf();
      if (!String(result).startsWith('OK')) {
        this.printStatusMessage = 'Save a PDF first, then open it here.';
      }
      return;
    }

    this.printStatusMessage = 'Open saved PDF is available in the installed Android app.';
  }

  private createCurrentPagePdf(reportPayload?: any): { blob: Blob; fileName: string } {
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10);
    const pageTitle = this.getCurrentPageTitle();
    const fileName = `${this.appName}-${pageTitle.replace(/[^a-z0-9]+/gi, '-')}-${dateStamp}.pdf`;
    const payload = reportPayload ?? this.createDomReportPayload();
    const lines = this.reportPayloadToPdfLines(payload, now);

    return {
      blob: this.buildPdf(lines),
      fileName,
    };
  }

  private async createReportPayload() {
    const cleanUrl = this.router.url.split('?')[0].split('#')[0];

    try {
      if (cleanUrl.startsWith('/tabs/dashboard')) {
        return this.buildDashboardReport(await this.fetchJson('dashboard.json'));
      }

      if (cleanUrl.startsWith('/tabs/overall-report')) {
        return this.buildOverallReport(await this.fetchJson('overall-report.json'));
      }

      if (cleanUrl.startsWith('/tabs/stock-report')) {
        return this.buildStockReport(await this.fetchJson('stock-report.json'));
      }

      if (cleanUrl.startsWith('/tabs/product-info')) {
        return this.buildProductInfoReport(await firstValueFrom(this.dataService.getProductInfo()));
      }

      if (cleanUrl.startsWith('/tabs/production-log')) {
        return this.buildInventoryTableReport(await this.fetchJson('production-log.json'), 'Production Details');
      }

      if (cleanUrl.startsWith('/tabs/recent-entries')) {
        return this.buildInventoryTableReport(await this.fetchJson('recent-entries.json'), 'Recent Stock Entries');
      }

      if (cleanUrl.startsWith('/tabs/inventory/packaging-rolls')) {
        return this.buildPackagingReport(await this.fetchJson('inventory-packaging.json'), 'rolls');
      }

      if (cleanUrl.startsWith('/tabs/inventory/packaging-bags')) {
        return this.buildPackagingReport(await this.fetchJson('inventory-packaging.json'), 'bags');
      }

      if (cleanUrl.startsWith('/tabs/inventory/packaging')) {
        return this.buildPackagingReport(await this.fetchJson('inventory-packaging.json'), 'all');
      }

      if (cleanUrl.startsWith('/tabs/inventory/raw-salt')) {
        return this.buildInventoryTableReport(await this.fetchJson('inventory-raw-salt.json'), 'Raw Salt Inventory');
      }

      if (cleanUrl.startsWith('/tabs/inventory/bundles')) {
        return this.buildInventoryTableReport(await this.fetchJson('inventory-bundles.json'), 'Bundle Inventory');
      }

      if (cleanUrl.startsWith('/tabs/inventory/consumables')) {
        return this.buildInventoryTableReport(await this.fetchJson('inventory-consumables.json'), 'Consumables Inventory');
      }

      if (cleanUrl.startsWith('/tabs/inventory/crystalline')) {
        return this.buildInventoryTableReport(await this.fetchJson('inventory-crystalline.json'), 'Product Inventory');
      }
    } catch {
      return this.createDomReportPayload();
    }

    return this.createDomReportPayload();
  }

  private createDomReportPayload() {
    const now = new Date();
    const pageTitle = this.getCurrentPageTitle();
    const root = this.getActiveContentRoot();
    const sectionElements = root ? Array.from(root.querySelectorAll('section')) : [];
    const sections = sectionElements
      .map((section, index) => this.sectionToReport(section, index))
      .filter((section) => section.lines.length > 0)
      .slice(0, 12);

    if (!sections.length && root) {
      sections.push({
        heading: pageTitle,
        lines: this.textToReportLines(root.textContent ?? '').slice(0, 36),
      });
    }

    return {
      title: `${this.appName} - ${pageTitle}`,
      generatedAt: now.toLocaleString(),
      source: location.pathname,
      sections,
    };
  }

  private async fetchJson(fileName: string): Promise<any> {
    const response = await fetch(`${this.apiBaseUrl}${this.getApiPath(fileName)}`, {
      cache: 'no-store',
      headers: this.apiKey ? { 'x-ledgerflow-api-key': this.apiKey } : {},
    });
    if (!response.ok) {
      throw new Error(`Unable to load ${fileName}`);
    }
    return response.json();
  }

  private getApiPath(fileName: string): string {
    const paths: Record<string, string> = {
      'dashboard.json': '/api/dashboard',
      'overall-report.json': '/api/reports/overall',
      'stock-report.json': '/api/reports/stock',
      'product-info.json': '/api/products/info',
      'production-log.json': '/api/reports/production-log',
      'recent-entries.json': '/api/reports/recent-entries',
      'inventory-packaging.json': '/api/inventory/packaging',
      'inventory-raw-salt.json': '/api/inventory/raw-salt',
      'inventory-bundles.json': '/api/inventory/bundles',
      'inventory-consumables.json': '/api/inventory/consumables',
      'inventory-crystalline.json': '/api/inventory/crystalline',
    };

    return paths[fileName] ?? '/api/dashboard';
  }

  private buildReport(title: string, sections: Array<{ heading: string; lines: string[] }>) {
    return {
      title: `${this.appName} - ${title}`,
      generatedAt: new Date().toLocaleString(),
      source: location.pathname,
      sections: sections.filter((section) => section.lines.length > 0),
    };
  }

  private buildDashboardReport(data: any) {
    return this.buildReport('Dashboard Report', [
      {
        heading: 'KPI Summary',
        lines: (data.kpis ?? []).map((kpi: any) => {
          const note = kpi.trend?.percentage || kpi.footer || '';
          return `${kpi.label}: ${kpi.value}${note ? ` (${note})` : ''}`;
        }),
      },
      {
        heading: 'Critical Stock Overview',
        lines: (data.criticalStock ?? []).map((item: any) =>
          `${item.name}: ${item.quantity} ${item.unit} - ${item.type === 'out-of-stock' ? 'Out of stock' : 'Low stock'}`
        ),
      },
      {
        heading: 'Inventory Breakdown',
        lines: (data.inventoryBreakdown ?? []).map((item: any) =>
          `${item.label}: ${item.value}${item.alert ? ' - Attention required' : ''}`
        ),
      },
    ]);
  }

  private buildOverallReport(data: any) {
    const chart = data.analytics?.bundlesPacked;
    return this.buildReport('Overall Report', [
      {
        heading: 'Performance Summary',
        lines: (data.kpis ?? []).map((kpi: any) => {
          const details = [kpi.target?.label, kpi.progress?.label, kpi.badge?.text, kpi.footer].filter(Boolean).join(', ');
          return `${kpi.label}: ${kpi.value}${kpi.unit ? ` ${kpi.unit}` : ''}${details ? ` (${details})` : ''}`;
        }),
      },
      {
        heading: 'Bundles Packed Trend',
        lines: chart ? chart.labels.map((label: string, index: number) => `${label}: ${chart.data[index]} bundles`) : [],
      },
    ]);
  }

  private buildStockReport(data: any) {
    return this.buildReport('Stock Report', [
      {
        heading: data.title || 'Stock Summary',
        lines: (data.cards ?? []).map((card: any) =>
          `${card.title}: ${card.value} ${card.unit} - ${card.trend?.text ?? this.statusLabel(card.status)}`
        ),
      },
    ]);
  }

  private buildProductInfoReport(data: any) {
    return this.buildReport('Product Inventory Details', [
      {
        heading: 'Product Summary',
        lines: [
          `Title: ${data.hero?.title ?? 'Inventory'}`,
          `Lot: ${data.hero?.lotNumber ?? 'N/A'}`,
          `Status: ${data.hero?.status ?? 'N/A'}`,
          `Average Monthly Yield: ${data.productionHighlights?.avgMonthlyYield?.value ?? '-'} ${data.productionHighlights?.avgMonthlyYield?.unit ?? ''}`,
        ],
      },
      {
        heading: 'Recent Stock Entries',
        lines: (data.recentEntries ?? []).map((entry: any) =>
          `${entry.label}: ${entry.quantity} on ${entry.date} (${entry.source})`
        ),
      },
      ...(data.inventoryCategories ?? []).map((category: any) => ({
        heading: category.title,
        lines: (category.items ?? []).map((item: any) =>
          `${item.name}: ${item.quantity} ${item.unit} - ${this.statusLabel(item.status)}`
        ),
      })),
    ]);
  }

  private buildInventoryTableReport(data: any, fallbackTitle: string) {
    return this.buildReport(data.title || fallbackTitle, [
      {
        heading: data.description || fallbackTitle,
        lines: (data.items ?? []).map((item: any) =>
          `${item.productGroup}${item.subLabel ? ` (${item.subLabel})` : ''}: ${item.quantity} ${item.unit} - ${this.statusLabel(item.status)}`
        ),
      },
    ]);
  }

  private buildPackagingReport(data: any, mode: 'all' | 'rolls' | 'bags') {
    const title = mode === 'rolls'
      ? 'Packaging Rolls Inventory'
      : mode === 'bags'
        ? 'Packaging Bags Inventory'
        : 'Packaging Inventory';
    const rollLines = (data.rolls ?? []).map((item: any) =>
      `${item.productGroup}: ${item.quantity} ${item.unit} - ${this.statusLabel(item.status)}`
    );
    const bagLines = (data.bags ?? []).map((item: any) =>
      `${item.productGroup}: ${item.quantity} ${item.unit} - ${this.statusLabel(item.status)}`
    );

    return this.buildReport(title, [
      ...(mode !== 'bags' ? [{ heading: 'Packaging Rolls', lines: rollLines }] : []),
      ...(mode !== 'rolls' ? [{ heading: 'Packaging Bags', lines: bagLines }] : []),
    ]);
  }

  private statusLabel(status: string): string {
    switch (status) {
      case 'in-stock':
      case 'ok':
      case 'green':
        return 'In stock';
      case 'low':
      case 'low-stock':
      case 'yellow':
        return 'Low stock';
      case 'critical':
      case 'out-of-stock':
      case 'red':
        return 'Attention required';
      default:
        return status || 'N/A';
    }
  }

  private reportPayloadToPdfLines(payload: any, now: Date): string[] {
    return [
      `# ${payload.title || `${this.appName} Report`}`,
      'GENERATED DATE/TIME',
      payload.generatedAt || now.toLocaleString(),
      'Asia/Calcutta',
      '',
      ...(payload.sections ?? []).flatMap((section: any) => [
        `## ${section.heading}`,
        ...(section.lines ?? []).map((line: string) => `- ${line}`),
        '',
      ]),
    ];
  }

  private getActiveContentRoot(): HTMLElement | null {
    const roots = Array.from(document.querySelectorAll('ion-content main')) as HTMLElement[];
    return roots.find((root) => {
      const rect = root.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) ?? roots[0] ?? null;
  }

  private sectionToReport(section: Element, index: number) {
    const headingElement = section.querySelector('h1, h2, h3');
    const heading = this.normalizeText(headingElement?.textContent ?? `Section ${index + 1}`);
    const rawText = this.normalizeText(section.textContent ?? '');
    const bodyText = rawText.startsWith(heading) ? rawText.slice(heading.length).trim() : rawText;

    return {
      heading,
      lines: this.textToReportLines(bodyText).slice(0, 18),
    };
  }

  private textToReportLines(text: string): string[] {
    const normalized = this.normalizeText(text);
    if (!normalized) {
      return [];
    }

    const chunks: string[] = [];
    let remaining = normalized;
    while (remaining.length > 0 && chunks.length < 48) {
      if (remaining.length <= 110) {
        chunks.push(remaining);
        break;
      }

      const slice = remaining.slice(0, 110);
      const breakAt = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('  '), slice.lastIndexOf(' '));
      const end = breakAt > 48 ? breakAt : 110;
      chunks.push(remaining.slice(0, end).trim());
      remaining = remaining.slice(end).trim();
    }

    return chunks;
  }

  private normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private getCurrentPageTitle(): string {
    const route = this.router.url.split('?')[0].split('#')[0].split('/').filter(Boolean).pop() ?? 'dashboard';
    return route
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private wrapText(text: string, limit: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';

    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > limit) {
        if (current) {
          lines.push(current);
        }
        current = word;
      } else {
        current = next;
      }
    });

    if (current) {
      lines.push(current);
    }

    return lines;
  }

  private buildPdf(lines: string[]): Blob {
    const pageWidth = 595;
    const pageHeight = 842;
    const marginX = 36;
    const bottomMargin = 42;
    const title = this.cleanPdfMarker(lines[0] || `${this.appName} Report`);
    const entries: Array<{ text: string; kind: string }> = [];
    lines.slice(1).forEach((line: string) => {
      entries.push(...this.pdfEntriesForLine(line));
    });
    const pages: Array<Array<{ text: string; kind: string }>> = [[]];
    let y = 742;

    entries.forEach((entry) => {
      const height = this.pdfEntryHeight(entry.kind);
      if (y - height < bottomMargin) {
        pages.push([]);
        y = 742;
      }
      pages[pages.length - 1].push(entry);
      y -= height;
    });

    const pageStreams = pages.map((pageEntries, pageIndex) => {
      const commands: string[] = [
        '0.93 0.96 1 rg 0 796 595 46 re f',
        '0.02 0.35 0.67 rg',
        `BT /F2 18 Tf ${marginX} 815 Td (${this.escapePdfText(title)}) Tj ET`,
        '0.35 0.38 0.45 rg',
        `BT /F1 8 Tf ${marginX} 26 Td (${this.escapePdfText(`LedgerFlow report - Page ${pageIndex + 1} of ${pages.length}`)}) Tj ET`,
      ];
      let cursorY = 760;

      pageEntries.forEach((entry) => {
        if (entry.kind === 'gap') {
          cursorY -= 8;
          return;
        }

        if (entry.kind === 'section') {
          commands.push('0.96 0.97 0.99 rg');
          commands.push(`${marginX} ${cursorY - 5} ${pageWidth - marginX * 2} 22 re f`);
          commands.push('0.1 0.12 0.16 rg');
          commands.push(`BT /F2 12 Tf ${marginX + 8} ${cursorY + 2} Td (${this.escapePdfText(entry.text.toUpperCase())}) Tj ET`);
          cursorY -= 28;
          return;
        }

        if (entry.kind === 'meta-label') {
          commands.push('0.38 0.42 0.5 rg');
          commands.push(`BT /F2 8 Tf ${marginX} ${cursorY} Td (${this.escapePdfText(entry.text.toUpperCase())}) Tj ET`);
          cursorY -= 13;
          return;
        }

        const font = entry.kind === 'row' ? '/F1 9 Tf' : '/F1 10 Tf';
        const color = entry.kind === 'row' ? '0.14 0.16 0.2 rg' : '0.06 0.08 0.12 rg';
        this.wrapText(entry.text, entry.kind === 'row' ? 94 : 86).forEach((wrappedLine) => {
          commands.push(color);
          commands.push(`BT ${font} ${marginX + (entry.kind === 'row' ? 10 : 0)} ${cursorY} Td (${this.escapePdfText(wrappedLine)}) Tj ET`);
          cursorY -= entry.kind === 'row' ? 12 : 14;
        });

        if (entry.kind === 'row') {
          commands.push('0.88 0.9 0.94 RG');
          commands.push(`0.5 w ${marginX} ${cursorY + 6} m ${pageWidth - marginX} ${cursorY + 6} l S`);
        }
      });

      return `${commands.join('\n')}\n`;
    });

    const objects: string[] = [];
    const addObject = (object: string) => {
      objects.push(object);
      return objects.length;
    };
    const catalogId = addObject('');
    const pagesId = addObject('');
    const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const pageIds: number[] = [];

    pageStreams.forEach((stream) => {
      const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
      const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    });

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let index = 1; index <= objects.length; index++) {
      pdf += `${offsets[index].toString().padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new Blob([pdf], { type: 'application/pdf' });
  }

  private pdfEntriesForLine(line: string): Array<{ text: string; kind: string }> {
    const text = line.trim();

    if (!text) {
      return [{ text: '', kind: 'gap' }];
    }

    if (text.startsWith('## ')) {
      return [{ text: text.slice(3), kind: 'section' }];
    }

    if (text === text.toUpperCase() && text.length <= 28) {
      return [{ text, kind: 'meta-label' }];
    }

    if (text.startsWith('- ')) {
      return [{ text: text.slice(2), kind: 'row' }];
    }

    return [{ text, kind: 'body' }];
  }

  private pdfEntryHeight(kind: string): number {
    switch (kind) {
      case 'section':
        return 30;
      case 'gap':
        return 10;
      case 'meta-label':
        return 14;
      case 'row':
        return 18;
      default:
        return 16;
    }
  }

  private cleanPdfMarker(text: string): string {
    return text.replace(/^#+\s*/, '').trim();
  }

  private escapePdfText(text: string): string {
    return text
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  private downloadPdf(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
}
