import { Component, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { IonTabs } from '@ionic/angular';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter, firstValueFrom } from 'rxjs';
import { DataService, DateFilterParams } from '../core/services/data.service';
import { DateFilterService } from '../core/services/date-filter.service';
import { DatePeriod } from '../core/models/inventory.models';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  fragment?: string;
}

interface ReportSection {
  heading: string;
  lines: string[];
  productColumn?: 'PRODUCT GROUP' | 'PRODUCT BRAND';
}

interface ReportPayload {
  title: string;
  generatedAt: string;
  source: string;
  period?: string;
  template?: 'summary' | 'inventory';
  sections: ReportSection[];
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
    private dataService: DataService,
    private dateFilter: DateFilterService
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
    const fileName = `${this.appName}-Combined-Report-${dateStamp}.pdf`;
    const payload = reportPayload ?? this.createDomReportPayload();

    return {
      blob: this.buildPdf(payload, now),
      fileName,
    };
  }

  private async createReportPayload() {
    return this.createCombinedReportPayload();
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
      period: this.currentPeriodLabel(),
      template: this.reportTemplateForRoute(),
      sections,
    };
  }

  private async createCombinedReportPayload(): Promise<ReportPayload> {
    const stockFilter = this.currentReportFilter('daily');
    const summaryFilter = this.currentReportFilter('monthly');
    const [stockReport, productInfo, productionLog, recentEntries] = await Promise.all([
      this.safeReportData(firstValueFrom(this.dataService.getStockReport(stockFilter)), { title: 'Stock Report', cards: [] }),
      this.safeReportData(firstValueFrom(this.dataService.getProductInfo()), {
        hero: { title: 'Inventory', lotNumber: 'N/A', status: 'N/A' },
        productionHighlights: { avgMonthlyYield: { value: 0, unit: 'Units' } },
        inventoryCategories: [],
        recentEntries: [],
      }),
      this.safeReportData(firstValueFrom(this.dataService.getProductionLog(summaryFilter)), { title: 'Production Details', breadcrumb: [], items: [] }),
      this.safeReportData(firstValueFrom(this.dataService.getRecentEntries(summaryFilter)), { title: 'Recent Stock Entries', breadcrumb: [], items: [] }),
    ]);
    const rawStock = (stockReport.cards || []).find((card: any) => String(card.title || '').toLowerCase().includes('raw'));
    const overallLines: string[] = [];

    (productInfo.inventoryCategories || [])
      .filter((category: any) => !String(category.title || '').toLowerCase().includes('raw stock'))
      .forEach((category: any) => {
        const categoryTitle = this.cleanReportText(category.title);

        (category.items || []).forEach((item: any) => {
          overallLines.push(this.reportRow(`${categoryTitle} - ${item.name}`, item.quantity, item.unit));
        });
      });
    (productionLog.items || []).forEach((item: any) => {
      overallLines.push(this.reportRow(`Production Output - ${item.productGroup}`, item.quantity, item.unit));
    });
    (recentEntries.items || []).forEach((item: any) => {
      overallLines.push(this.reportRow(`Stock Entries - ${item.productGroup}`, item.quantity, item.unit));
    });
    const sections: ReportSection[] = [
      {
        heading: 'Stock Report',
        productColumn: 'PRODUCT GROUP' as const,
        lines: rawStock ? [this.reportRow('Raw Salt', rawStock.value, rawStock.unit)] : [],
      },
      {
        heading: 'Overall Report',
        productColumn: 'PRODUCT GROUP' as const,
        lines: overallLines,
      },
    ].filter((section) => section.lines.length > 0);

    return {
      title: 'Overall Report',
      generatedAt: new Date().toLocaleString(),
      source: 'Combined inventory and summary report',
      period: this.dateFilter.getFormattedDate('monthly', new Date()),
      template: 'inventory',
      sections,
    };
  }

  private async safeReportData<T>(promise: Promise<T>, fallback: T): Promise<T> {
    try {
      return await promise;
    } catch {
      return fallback;
    }
  }

  private reportRow(product: unknown, quantity: unknown, unit: unknown): string {
    return `${this.cleanReportText(product)}\t${this.formatReportQuantity(quantity)}\t${this.cleanReportText(unit)}`;
  }

  private cleanReportText(value: unknown): string {
    return String(value ?? '').replace(/\s+/g, ' ').trim() || 'N/A';
  }

  private formatReportQuantity(value: unknown): string {
    const numeric = Number(String(value ?? '').replace(/,/g, ''));
    if (!Number.isFinite(numeric)) {
      return this.cleanReportText(value);
    }

    return numeric.toLocaleString('en-US', {
      maximumFractionDigits: 3,
    });
  }

  private currentReportFilter(periodOverride?: DatePeriod): DateFilterParams {
    const period = periodOverride ?? this.dateFilter.getCurrentPeriod();
    const date = this.dateFilter.getInputDateValue();

    return this.dateFilter.buildFilter(period, date);
  }

  private currentPeriodLabel(): string {
    const period = this.dateFilter.getCurrentPeriod();
    return this.dateFilter.getFormattedDate(period, new Date());
  }

  private reportTemplateForRoute(): 'summary' | 'inventory' {
    const cleanUrl = this.router.url.split('?')[0].split('#')[0];
    return cleanUrl.startsWith('/tabs/stock-report') || cleanUrl.includes('/inventory') || cleanUrl.startsWith('/tabs/product-info')
      ? 'inventory'
      : 'summary';
  }

  private buildReport(title: string, sections: Array<{ heading: string; lines: string[] }>, template: 'summary' | 'inventory' = 'summary'): ReportPayload {
    return {
      title: `${this.appName} - ${title}`,
      generatedAt: new Date().toLocaleString(),
      source: location.pathname,
      period: this.currentPeriodLabel(),
      template,
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
    const analytics = [
      data.analytics?.bundlesPacked,
      data.analytics?.materialConsumed,
      data.analytics?.newStock,
      data.analytics?.orders,
    ].filter(Boolean);

    return this.buildReport('Overall Report', [
      {
        heading: 'Performance Summary',
        lines: (data.kpis ?? []).map((kpi: any) => {
          const details = [kpi.target?.label, kpi.progress?.label, kpi.badge?.text, kpi.footer].filter(Boolean).join(', ');
          return `${kpi.label}: ${kpi.value}${kpi.unit ? ` ${kpi.unit}` : ''}${details ? ` (${details})` : ''}`;
        }),
      },
      ...analytics.map((chart: any) => ({
        heading: chart.label || 'Performance Trend',
        lines: chart.labels.map((label: string, index: number) => `${label}: ${chart.data[index] ?? 0}`),
      })),
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
    ], 'inventory');
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
    ], 'inventory');
  }

  private buildInventoryTableReport(data: any, fallbackTitle: string) {
    return this.buildReport(data.title || fallbackTitle, [
      {
        heading: data.description || fallbackTitle,
        lines: (data.items ?? []).map((item: any) =>
          `${item.productGroup}${item.subLabel ? ` (${item.subLabel})` : ''}: ${item.quantity} ${item.unit} - ${this.statusLabel(item.status)}`
        ),
      },
    ], 'inventory');
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
    ], 'inventory');
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

  private buildPdf(payload: ReportPayload, _now: Date): Blob {
    const pageWidth = 595;
    const pageHeight = 842;
    const marginX = 36;
    const bottomMargin = 42;
    const contentWidth = pageWidth - marginX * 2;
    const sections = (payload.sections || []).filter((section) => section.lines?.length);
    const template = payload.template || 'summary';
    const pages: string[][] = [];
    let commands: string[] = [];
    let cursorY = 0;

    const color = {
      ink: '0.06 0.08 0.12',
      muted: '0.35 0.39 0.46',
      blue: '0.02 0.35 0.67',
      paleBlue: '0.93 0.96 1',
      paleGray: '0.96 0.97 0.99',
      border: '0.82 0.85 0.9',
      white: '1 1 1',
    };
    const addFill = (fill: string) => commands.push(`${fill} rg`);
    const addStroke = (stroke: string) => commands.push(`${stroke} RG`);
    const rect = (x: number, y: number, width: number, height: number, fill: string, stroke?: string) => {
      addFill(fill);
      commands.push(`${x} ${y} ${width} ${height} re f`);
      if (stroke) {
        addStroke(stroke);
        commands.push(`${x} ${y} ${width} ${height} re S`);
      }
    };
    const text = (value: string, x: number, y: number, size = 10, bold = false, fill = color.ink) => {
      addFill(fill);
      commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${this.escapePdfText(value)}) Tj ET`);
    };
    const line = (x1: number, y1: number, x2: number, y2: number, stroke = color.border) => {
      addStroke(stroke);
      commands.push(`0.6 w ${x1} ${y1} m ${x2} ${y2} l S`);
    };
    const wrap = (value: string, limit: number) => this.wrapText(value, limit);
    const startPage = () => {
      commands = [];
      pages.push(commands);
      rect(0, 0, pageWidth, pageHeight, color.white);
      cursorY = 812;
    };
    const ensureSpace = (height: number) => {
      if (cursorY - height < bottomMargin) {
        startPage();
      }
    };
    const drawSectionTitle = (heading: string) => {
      ensureSpace(28);
      rect(marginX, cursorY - 2, contentWidth, 20, template === 'inventory' ? color.paleBlue : color.paleGray, color.border);
      text(heading.toUpperCase(), marginX + 10, cursorY + 4, 9, true, color.ink);
      cursorY -= 28;
    };
    const parseLine = (value: string) => {
      const columns = value.split('\t');
      if (columns.length >= 3) {
        return {
          label: columns[0].trim(),
          value: columns[1].trim(),
          status: columns.slice(2).join(' ').trim(),
        };
      }

      const [label, rest = ''] = value.split(/:\s(.+)/);
      const [primary, status = ''] = rest.split(/\s-\s(.+)/);
      return {
        label: (label || value).trim(),
        value: (primary || '').trim(),
        status: (status || '').trim(),
      };
    };
    const drawCards = (section: ReportSection) => {
      drawSectionTitle(section.heading);
      const gap = 10;
      const cardWidth = (contentWidth - gap) / 2;
      const cardHeight = 58;
      section.lines.forEach((item, index) => {
        ensureSpace(cardHeight + 10);
        const parsed = parseLine(item);
        const column = index % 2;
        const x = marginX + column * (cardWidth + gap);

        if (column === 0 && index > 0) {
          cursorY -= cardHeight + 10;
        }

        rect(x, cursorY - cardHeight + 12, cardWidth, cardHeight, color.white, color.border);
        text(parsed.label.toUpperCase(), x + 10, cursorY - 4, 7, true, color.muted);
        wrap(parsed.value || '-', 28).slice(0, 2).forEach((wrapped, lineIndex) => {
          text(wrapped, x + 10, cursorY - 22 - lineIndex * 12, lineIndex === 0 ? 15 : 9, lineIndex === 0, color.ink);
        });
        if (parsed.status) {
          text(parsed.status, x + 10, cursorY - 48, 7, false, color.muted);
        }
      });
      cursorY -= cardHeight + 16;
    };
    const drawTable = (section: ReportSection) => {
      drawSectionTitle(section.heading);
      const col1 = 318;
      const col2 = 88;
      const productColumn = section.productColumn || (template === 'inventory' ? 'PRODUCT GROUP' : 'PRODUCT BRAND');

      ensureSpace(20);
      rect(marginX, cursorY - 2, contentWidth, 17, color.blue);
      text(productColumn, marginX + 8, cursorY + 3, 6.5, true, color.white);
      text('QUANTITY', marginX + col1 + 8, cursorY + 3, 6.5, true, color.white);
      text('UNIT', marginX + col1 + col2 + 8, cursorY + 3, 6.5, true, color.white);
      cursorY -= 19;

      section.lines.forEach((item, index) => {
        const parsed = parseLine(item);
        const labelLines = wrap(parsed.label, 52);
        const valueLines = wrap(parsed.value || '-', 13);
        const statusLines = wrap(parsed.status || '-', 18);
        const rowHeight = Math.max(23, 10 + Math.max(labelLines.length, valueLines.length, statusLines.length) * 10);
        ensureSpace(rowHeight + 2);

        if (index % 2 === 0) {
          rect(marginX, cursorY - rowHeight + 10, contentWidth, rowHeight, color.paleGray);
        }
        labelLines.slice(0, 3).forEach((wrapped, lineIndex) => text(wrapped, marginX + 8, cursorY - 2 - lineIndex * 10, 8, lineIndex === 0, color.ink));
        valueLines.slice(0, 3).forEach((wrapped, lineIndex) => text(wrapped, marginX + col1 + 8, cursorY - 2 - lineIndex * 10, 8, lineIndex === 0, color.ink));
        statusLines.slice(0, 3).forEach((wrapped, lineIndex) => text(wrapped, marginX + col1 + col2 + 8, cursorY - 2 - lineIndex * 10, 7.5, false, color.muted));
        line(marginX, cursorY - rowHeight + 8, pageWidth - marginX, cursorY - rowHeight + 8, color.border);
        cursorY -= rowHeight;
      });
      cursorY -= 8;
    };

    startPage();
    sections.forEach((section) => drawTable(section));

    const pageStreams = pages.map((pageCommands, pageIndex) => {
      pageCommands.push('0.35 0.38 0.45 rg');
      pageCommands.push(`BT /F1 8 Tf ${marginX} 26 Td (${this.escapePdfText(`${this.appName} report - Page ${pageIndex + 1} of ${pages.length}`)}) Tj ET`);
      pageCommands.push(`BT /F1 8 Tf ${pageWidth - 156} 26 Td (${this.escapePdfText(payload.source || location.pathname)}) Tj ET`);
      return `${pageCommands.join('\n')}\n`;
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
