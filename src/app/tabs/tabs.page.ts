import { Component, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { IonTabs } from '@ionic/angular';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter, firstValueFrom } from 'rxjs';
import { DataService, DateFilterParams } from '../core/services/data.service';
import { ActiveDateSelection, DateFilterService } from '../core/services/date-filter.service';

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

interface ReportHeadingBlock {
  type: 'heading';
  heading: string;
  subtitle?: string;
}

interface ReportTableBlock {
  type: 'table';
  heading?: string;
  eyebrow?: string;
  columns: string[];
  rows: string[][];
  totals?: string[];
}

type ReportBlock = ReportHeadingBlock | ReportTableBlock;

interface ReportPayload {
  title: string;
  generatedAt: string;
  source: string;
  period?: string;
  template?: 'summary' | 'inventory';
  sections: ReportSection[];
  blocks?: ReportBlock[];
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
    const activeSelection = this.dateFilter.getActiveSelection();
    const reportFilter = this.currentReportFilter(activeSelection);
    const stockFilter = reportFilter;
    const summaryFilter = reportFilter;
    const [stockReport, summaryReport] = await Promise.all([
      this.safeReportData(firstValueFrom(this.dataService.getRawStockReport(stockFilter)), { data: {} }),
      this.safeReportData(firstValueFrom(this.dataService.getRawSummaryReport(summaryFilter)), { data: { reports: {} } }),
    ]);
    const period = this.formatSelectionPeriodRange(activeSelection);
    const reportSubtitle = this.formatSelectionPeriodSubtitle(activeSelection);
    const blocks: ReportBlock[] = [
      { type: 'heading', heading: 'Stock Report' },
      ...this.stockReportBlocks(stockReport),
      { type: 'heading', heading: 'Overall Report', subtitle: reportSubtitle },
      ...this.summaryReportBlocks(summaryReport),
    ];

    return {
      title: 'Overall Report',
      generatedAt: new Date().toLocaleString(),
      source: 'Combined inventory and summary report',
      period,
      template: 'inventory',
      sections: [],
      blocks,
    };
  }

  private async safeReportData<T>(promise: Promise<T>, fallback: T): Promise<T> {
    try {
      return await promise;
    } catch {
      return fallback;
    }
  }

  private stockReportBlocks(stock: any): ReportBlock[] {
    const rawStock = this.rawSaltStock(stock);
    const blocks: ReportBlock[] = [
      {
        type: 'table',
        heading: 'Raw Stock',
        eyebrow: 'Live Ledger',
        columns: ['PRODUCT GROUP', 'QUANTITY', 'UNIT'],
        rows: rawStock.productGroup
          ? [[
              this.cleanReportText(rawStock.productGroup || 'Raw Salt'),
              this.formatReportQuantity(rawStock.qty),
              this.displayReportUnit(rawStock.unitName),
            ]]
          : [],
      },
      { type: 'heading', heading: 'Finished Goods' },
    ];

    const finishedGoodsPlants = [...(stock?.data?.finishedGoods || [])]
      .sort((left: any, right: any) => this.reportUnitSort(this.reportUnitLabel(left?.plantName)) - this.reportUnitSort(this.reportUnitLabel(right?.plantName)));

    finishedGoodsPlants.forEach((plant: any) => {
      const productGroups = [...(plant.groups || [])]
        .sort((left: any, right: any) => this.firstReportText(left?.productGroup, 'Products').localeCompare(this.firstReportText(right?.productGroup, 'Products')));

      productGroups.forEach((group: any) => {
        const products = group.products || [];
        blocks.push({
          type: 'table',
          heading: this.cleanReportText(plant.plantName || 'Finished Goods'),
          eyebrow: this.cleanReportText(group.productGroup || 'Products'),
          totals: this.unitTotals(products),
          columns: ['PRODUCT', 'QUANTITY', 'UNIT'],
          rows: products.map((product: any) => [
            this.firstReportText(product.productBrand, product.productGroup),
            this.formatReportQuantity(product.qty),
            this.displayReportUnit(product.unitName),
          ]),
        });
      });
    });

    blocks.push({ type: 'heading', heading: 'Inventory Overview' });
    (stock?.data?.inventory || []).forEach((category: any) => {
      const products = category.products || [];
      const categoryName = this.cleanReportText(category.productName || 'Inventory');

      blocks.push({
        type: 'table',
        heading: categoryName === 'Bag (unpacked)' ? 'Inventory Overview' : `Category: ${categoryName}`,
        totals: this.unitTotals(products),
        columns: ['PRODUCT GROUP', 'QUANTITY', 'UNIT', 'STOCK'],
        rows: products.map((product: any) => [
          this.cleanReportText(product.productGroup),
          this.formatReportQuantity(product.qty),
          this.displayReportUnit(product.unitName),
          this.stockHealthLabel(product.qty),
        ]),
      });
    });

    return this.nonEmptyBlocks(blocks);
  }

  private summaryReportBlocks(summary: any): ReportBlock[] {
    const reports = summary?.data?.reports || {};
    const blocks: ReportBlock[] = [
      ...this.groupedSummaryTables(
        'Production Output',
        this.reportRows(reports, 'production', 'productionOutput', 'productionReport'),
        'PRODUCT'
      ),
      ...this.flatSummaryTables(
        'Inventory Used Consumed',
        this.reportRows(reports, 'inventoryUsed', 'inventoryUsedConsumed', 'materialConsumed', 'consumedInventory'),
        true
      ),
      ...this.flatSummaryTables(
        'Stock Entries',
        this.reportRows(reports, 'stockEntry', 'stockEntries', 'incomingStock', 'incomingData'),
        false
      ),
      ...this.ordersReportTables(
        this.reportRows(reports, 'orderPlaced', 'ordersPlaced', 'orders')
      ),
    ];

    return this.nonEmptyBlocks(blocks);
  }

  private groupedSummaryTables(sectionHeading: string, rows: any[], productColumn: string): ReportBlock[] {
    const blocks: ReportBlock[] = [{ type: 'heading', heading: sectionHeading }];
    this.rowsByReportUnit(rows).forEach(([unitName, unitRows]) => {
      const groupedRows = new Map<string, any[]>();

      unitRows.forEach((row) => {
        const productGroup = this.firstReportText(row.productGroup, row.productName, 'Products');
        const group = groupedRows.get(productGroup) || [];
        group.push(row);
        groupedRows.set(productGroup, group);
      });

      groupedRows.forEach((groupRows, productGroup) => {
        blocks.push({
          type: 'table',
          heading: unitName,
          eyebrow: productGroup,
          totals: this.unitTotals(groupRows),
          columns: [productColumn, 'QUANTITY', 'UNIT'],
          rows: groupRows.map((row) => [
            this.reportProductLabel(row),
            this.formatReportQuantity(this.reportQuantity(row)),
            this.displayReportUnit(row.unit || row.unitName),
          ]),
        });
      });
    });

    return blocks;
  }

  private flatSummaryTables(sectionHeading: string, rows: any[], numbered: boolean): ReportBlock[] {
    if (!rows.length) {
      return [];
    }

    const blocks: ReportBlock[] = [{ type: 'heading', heading: sectionHeading }];
    this.rowsByReportUnit(rows).forEach(([unitName, unitRows]) => {
      const groups = new Map<string, any[]>();
      unitRows.forEach((row) => {
        const key = this.firstReportText(row.productName, sectionHeading);
        const group = groups.get(key) || [];
        group.push(row);
        groups.set(key, group);
      });

      groups.forEach((groupRows, productName) => {
        const columns = numbered
          ? ['#', 'PRODUCT NAME', 'PRODUCT GROUP', 'QUANTITY', 'UNIT']
          : ['PRODUCT GROUP', 'QUANTITY', 'UNIT'];
        const tableRows = groupRows.map((row, index) => numbered
          ? [
              String(index + 1),
              this.firstReportText(row.productName, productName),
              this.firstReportText(row.productGroup, row.productBrand, row.itemName),
              this.formatReportQuantity(this.reportQuantity(row)),
              this.displayReportUnit(row.unit || row.unitName),
            ]
          : [
              this.reportProductLabel(row),
              this.formatReportQuantity(this.reportQuantity(row)),
              this.displayReportUnit(row.unit || row.unitName),
            ]);

        blocks.push({
          type: 'table',
          heading: unitName === 'General / Unassigned' ? productName : `${unitName} - ${productName}`,
          totals: this.unitTotals(groupRows),
          columns,
          rows: tableRows,
        });
      });
    });

    return blocks;
  }

  private ordersReportTables(rows: any[]): ReportBlock[] {
    if (!rows.length) {
      return [];
    }

    const blocks: ReportBlock[] = [{ type: 'heading', heading: 'Orders Placed' }];

    this.rowsByReportUnit(rows).forEach(([unitName, unitRows]) => {
      blocks.push({
        type: 'table',
        heading: unitName === 'General / Unassigned' ? 'Orders' : `Orders - ${unitName}`,
        totals: this.unitTotals(unitRows),
        columns: ['PRODUCT', 'QUANTITY', 'UNIT'],
        rows: unitRows.map((row) => [
          this.reportProductLabel(row),
          this.formatReportQuantity(this.reportQuantity(row)),
          this.displayReportUnit(row.unit || row.unitName),
        ]),
      });
    });

    return blocks;
  }

  private nonEmptyBlocks(blocks: ReportBlock[]): ReportBlock[] {
    const result: ReportBlock[] = [];

    blocks.forEach((block) => {
      if (block.type === 'heading') {
        result.push(block);
        return;
      }

      if (block.rows.length) {
        result.push(block);
      }
    });

    return result.filter((block, index) => {
      if (block.type !== 'heading') {
        return true;
      }

      return Boolean(result[index + 1] && result[index + 1].type !== 'heading');
    });
  }

  private reportRows(reports: any, ...keys: string[]): any[] {
    for (const key of keys) {
      if (Array.isArray(reports?.[key])) {
        return reports[key];
      }
    }

    return [];
  }

  private rowsByReportUnit(rows: any[]): Array<[string, any[]]> {
    const groups = new Map<string, any[]>();

    rows.forEach((row) => {
      const unitName = this.reportUnitLabelFromRow(row);
      const group = groups.get(unitName) || [];
      group.push(row);
      groups.set(unitName, group);
    });

    return Array.from(groups.entries()).sort(([left], [right]) => this.reportUnitSort(left) - this.reportUnitSort(right));
  }

  private reportUnitLabel(value: unknown): string {
    const unitName = this.cleanReportText(value);
    return unitName === 'N/A' ? 'General / Unassigned' : unitName;
  }

  private reportUnitLabelFromRow(row: any): string {
    const plantName = this.reportUnitLabel(row?.plantName);

    if (plantName !== 'General / Unassigned') {
      return plantName;
    }

    return this.reportUnitLabelFromProductCode(row?.productCode);
  }

  private reportUnitLabelFromProductCode(value: unknown): string {
    const productCode = this.cleanReportText(value);

    if (productCode === 'N/A') {
      return 'General / Unassigned';
    }

    const unitMarkerIndex = productCode.lastIndexOf('--');
    const candidate = unitMarkerIndex >= 0
      ? productCode.slice(unitMarkerIndex + 2).replace(/^-+|-+$/g, '').trim()
      : '';

    if (/unit\s*\d/i.test(candidate)) {
      return this.cleanReportText(candidate);
    }

    const match = productCode.match(/unit\s*\d[^-]*/i);
    return match ? this.cleanReportText(match[0]) : 'General / Unassigned';
  }

  private reportUnitSort(unitName: string): number {
    const normalized = unitName.toLowerCase();

    if (normalized.includes('unit 1')) {
      return 1;
    }

    if (normalized.includes('unit 2')) {
      return 2;
    }

    if (normalized.includes('general') || normalized.includes('unassigned')) {
      return 99;
    }

    return 50;
  }

  private rawSaltStock(source: any): any {
    const rawStock = source?.data?.rawSaltStock;

    if (Array.isArray(rawStock)) {
      return rawStock[0] || {};
    }

    return rawStock || {};
  }

  private unitTotals(rows: any[]): string[] {
    const totals = new Map<string, number>();

    rows.forEach((row) => {
      const unit = this.displayReportUnit(row.unit || row.unitName);
      const current = totals.get(unit) || 0;
      totals.set(unit, current + this.reportQuantity(row));
    });

    return Array.from(totals.entries()).map(([unit, value]) => `${unit} - ${this.formatReportQuantity(value)}`);
  }

  private reportQuantity(row: any): number {
    const value = row?.quantity ?? row?.qty ?? row?.totalQuantity ?? row?.stockQty ?? row?.stock;
    const numeric = Number(String(value ?? '').replace(/,/g, '').replace(/[^\d.-]/g, ''));

    return Number.isFinite(numeric) ? numeric : 0;
  }

  private reportRow(product: unknown, quantity: unknown, unit: unknown): string {
    return `${this.cleanReportText(product)}\t${this.formatReportQuantity(quantity)}\t${this.cleanReportText(unit)}`;
  }

  private cleanReportText(value: unknown): string {
    const textValue = String(value ?? '').replace(/\s+/g, ' ').trim();
    const normalized = textValue.toLowerCase();

    if (!textValue || normalized === 'null' || normalized === 'undefined' || normalized === 'n/a' || normalized === 'na') {
      return 'N/A';
    }

    return textValue;
  }

  private firstReportText(...values: unknown[]): string {
    for (const value of values) {
      const cleanValue = this.cleanReportText(value);
      if (cleanValue !== 'N/A') {
        return cleanValue;
      }
    }

    return 'N/A';
  }

  private reportProductLabel(row: any): string {
    return this.firstReportText(row?.productBrand, row?.productGroup, row?.productName, row?.itemName, row?.productCode);
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

  private displayReportUnit(value: unknown): string {
    const unit = this.cleanReportText(value);
    const normalized = unit.toLowerCase();

    if (normalized === 'piece' || normalized === 'pieces') {
      return 'Piece';
    }

    if (normalized === 'kilogram' || normalized === 'kilograms') {
      return 'Kilogram';
    }

    if (normalized === 'metric ton' || normalized === 'metric tons') {
      return 'Metric Ton';
    }

    return unit;
  }

  private stockHealthLabel(value: unknown): string {
    const quantity = Number(String(value ?? '').replace(/,/g, ''));

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return 'Out of Stock';
    }

    if (quantity <= 100) {
      return 'Low';
    }

    return 'Healthy';
  }

  private formatSelectionPeriodRange(selection: ActiveDateSelection): string {
    const start = this.dateFilter.parseInputDate(selection.range.startIso);
    const end = this.dateFilter.parseInputDate(selection.range.endIso);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return this.formatReportPeriodRange(this.currentReportFilter(selection));
    }

    if (selection.range.startIso === selection.range.endIso) {
      return this.formatReportDate(start);
    }

    return `${this.formatReportDate(start)} - ${this.formatReportDate(end)}`;
  }

  private formatSelectionPeriodSubtitle(selection: ActiveDateSelection): string {
    const start = this.dateFilter.parseInputDate(selection.range.startIso);
    const end = this.dateFilter.parseInputDate(selection.range.endIso);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return this.formatReportPeriodSubtitle(this.currentReportFilter(selection));
    }

    if (selection.range.startIso === selection.range.endIso) {
      return this.formatReportLongDate(start);
    }

    return `${this.formatReportLongDate(start)} - ${this.formatReportLongDate(end)}`;
  }

  private formatReportPeriodRange(filter: DateFilterParams): string {
    const start = filter.fromDate ? new Date(filter.fromDate) : null;
    const end = filter.toDate ? new Date(filter.toDate) : null;

    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return this.currentPeriodLabel();
    }

    return `${this.formatReportDate(start)} - ${this.formatReportDate(end)}`;
  }

  private formatReportPeriodSubtitle(filter: DateFilterParams): string {
    const start = filter.fromDate ? new Date(filter.fromDate) : null;
    const end = filter.toDate ? new Date(filter.toDate) : null;

    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return this.currentPeriodLabel();
    }

    return `${this.formatReportLongDate(start)} - ${this.formatReportLongDate(end)}`;
  }

  private formatReportDate(date: Date): string {
    const { day, month, year } = this.indiaDateParts(date);

    return `${String(day).padStart(2, '0')} ${month} ${year}`;
  }

  private formatReportLongDate(date: Date): string {
    const weekday = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      timeZone: 'Asia/Kolkata',
    }).format(date);

    return `${weekday}, ${this.formatReportDate(date)}`;
  }

  private reportDayCount(start: Date, end: Date): number {
    const startParts = this.indiaDateParts(start);
    const endParts = this.indiaDateParts(end);
    const startUtc = Date.UTC(startParts.year, startParts.monthIndex, startParts.day);
    const endUtc = Date.UTC(endParts.year, endParts.monthIndex, endParts.day);

    return Math.max(1, Math.round((endUtc - startUtc) / 86400000) + 1);
  }

  private indiaDateParts(date: Date): { day: number; month: string; monthIndex: number; year: number } {
    const parts = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).formatToParts(date);
    const partValue = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    const month = partValue('month');

    return {
      day: Number(partValue('day')),
      month,
      monthIndex: new Date(`${month} 1, 2000`).getMonth(),
      year: Number(partValue('year')),
    };
  }

  private ordinalSuffix(day: number): string {
    if (day % 100 >= 11 && day % 100 <= 13) {
      return 'th';
    }

    switch (day % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  }

  private currentReportFilter(activeSelection: ActiveDateSelection = this.dateFilter.getActiveSelection()): DateFilterParams {
    const isCustomRange = activeSelection.period === 'custom';
    const apiPeriod = isCustomRange ? 'weekly' : activeSelection.period;
    const filter = this.dateFilter.buildFilter(apiPeriod, activeSelection.date, activeSelection.range);

    return isCustomRange ? { ...filter, rangeType: 'custom' as const } : filter;
  }

  private currentPeriodLabel(): string {
    const activeSelection = this.dateFilter.getActiveSelection();
    return this.dateFilter.getFormattedDate(activeSelection.period, activeSelection.date, activeSelection.range);
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

  private buildPdf(payload: ReportPayload, now: Date): Blob {
    const pageWidth = 595;
    const pageHeight = 842;
    const marginX = 42.5;
    const bottomMargin = 30;
    const contentWidth = pageWidth - marginX * 2;
    const sections = (payload.sections || []).filter((section) => section.lines?.length);
    const structuredBlocks = payload.blocks || [];
    const template = payload.template || 'summary';
    const pages: string[][] = [];
    let commands: string[] = [];
    let cursorY = 0;
    let pageHasContent = false;
    let summaryCardDrawn = false;

    const color = {
      ink: '0.16 0.2 0.22',
      title: '0.2 0.2 0.36',
      muted: '0.37 0.41 0.44',
      blue: '0.03 0.37 0.66',
      paleBlue: '0.94 0.97 1',
      paleGray: '0.97 0.98 0.99',
      border: '0.84 0.87 0.91',
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
    const textWidth = (value: string, size = 10, bold = false) =>
      this.escapePdfText(value).length * size * (bold ? 0.58 : 0.52);
    const alignedText = (
      value: string,
      x: number,
      y: number,
      width: number,
      size = 10,
      bold = false,
      fill = color.ink,
      align: 'left' | 'center' | 'right' = 'left'
    ) => {
      const padding = 6;
      let textX = x + padding;

      if (align === 'right') {
        textX = x + width - padding - textWidth(value, size, bold);
      } else if (align === 'center') {
        textX = x + (width - textWidth(value, size, bold)) / 2;
      }

      text(value, Math.max(x + padding, textX), y, size, bold, fill);
    };
    const rightText = (value: string, rightX: number, y: number, size = 10, bold = false, fill = color.ink) => {
      text(value, rightX - textWidth(value, size, bold), y, size, bold, fill);
    };
    const line = (x1: number, y1: number, x2: number, y2: number, stroke = color.border) => {
      addStroke(stroke);
      commands.push(`0.6 w ${x1} ${y1} m ${x2} ${y2} l S`);
    };
    const wrap = (value: string, limit: number) => this.wrapText(value, limit);
    const drawSummaryCard = () => {
      const periodLines = wrap(payload.period || this.currentPeriodLabel(), 64).slice(0, 2);
      const cardWidth = contentWidth;
      const cardHeight = periodLines.length > 1 ? 40 : 34;

      rect(marginX, cursorY - cardHeight, cardWidth, cardHeight, color.paleGray, color.border);
      text('SUMMARY PERIOD', marginX + 10, cursorY - 13, 6.8, true, color.muted);
      periodLines.forEach((periodLine, lineIndex) => {
        text(periodLine, marginX + 10, cursorY - 26 - lineIndex * 10, 9.2, true, color.title);
      });
      cursorY -= cardHeight + 14;
      summaryCardDrawn = true;
    };
    const startPage = () => {
      commands = [];
      pages.push(commands);
      rect(0, 0, pageWidth, pageHeight, color.white);
      cursorY = pageHeight - 50;
      pageHasContent = false;
    };
    const generatedDateLabel = () => now.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).replace(',', '');
    const drawGeneratedCard = () => {
      const cardWidth = 175;
      const cardHeight = 50;
      const x = pageWidth - marginX - cardWidth;
      const y = pageHeight - 100;

      rect(x, y, cardWidth, cardHeight, color.paleGray, color.border);
      text('GENERATED DATE/TIME', x + 12, y + 33, 6.8, true, color.muted);
      text(generatedDateLabel(), x + 12, y + 18, 8.5, true, color.ink);
      text('Asia/Calcutta', x + 12, y + 7, 7.4, false, color.muted);
    };
    const drawTemplateTitle = (heading: string, subtitle?: string, generated = false) => {
      if (pageHasContent) {
        startPage();
      }

      text(heading, marginX, pageHeight - 62, 25, true, color.title);

      if (subtitle) {
        text(subtitle, marginX, pageHeight - 82, 9.2, false, color.muted);
      }

      if (generated) {
        drawGeneratedCard();
      }

      cursorY = pageHeight - (generated ? 118 : 102);

      if (payload.period) {
        drawSummaryCard();
      }

      pageHasContent = true;
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
    const tableColumnWidths = (columns: string[]) => {
      const normalizedColumns = columns.map((column) => column.toLowerCase());

      if (columns.length === 3 && normalizedColumns.includes('quantity') && normalizedColumns.includes('unit')) {
        return [contentWidth - 150, 86, 64];
      }

      if (columns.length === 4 && normalizedColumns.includes('stock')) {
        return [contentWidth - 222, 82, 64, 76];
      }

      if (columns.length === 4 && normalizedColumns.includes('customer')) {
        return [150, contentWidth - 294, 86, 58];
      }

      if (columns.length === 6 && normalizedColumns.includes('#')) {
        return [24, 136, 136, 84, 72, 58];
      }

      if (columns.length === 5 && normalizedColumns.includes('#')) {
        return [24, 154, contentWidth - 324, 82, 64];
      }

      const widths: number[] = columns.map((column) => {
        const normalized = column.toLowerCase();

        if (normalized === '#') {
          return 24;
        }

        if (normalized.includes('quantity')) {
          return 82;
        }

        if (normalized === 'unit') {
          return 64;
        }

        if (normalized === 'stock') {
          return 76;
        }

        if (normalized.includes('customer')) {
          return 116;
        }

        if (normalized.includes('brand') && columns.length > 3) {
          return 98;
        }

        return 0;
      });
      const fixedWidth = widths.reduce((sum, width) => sum + width, 0);
      const flexibleCount = widths.filter((width) => width === 0).length;
      const flexibleWidth = flexibleCount > 0 ? Math.max(82, (contentWidth - fixedWidth) / flexibleCount) : 0;

      return widths.map((width) => width || flexibleWidth);
    };
    const columnAlignment = (column: string): 'left' | 'center' | 'right' => {
      const normalized = column.toLowerCase();

      if (normalized.includes('quantity')) {
        return 'right';
      }

      if (normalized === '#' || normalized === 'unit' || normalized === 'stock') {
        return 'center';
      }

      return 'left';
    };
    const drawHeadingBlock = (block: ReportHeadingBlock) => {
      if (block.heading === 'Stock Report') {
        drawTemplateTitle(block.heading, block.subtitle, true);
        return;
      }

      if (block.heading === 'Overall Report') {
        ensureSpace(88);
        rect(marginX, cursorY - 20, contentWidth, 20, color.paleGray, color.border);
        text(block.heading.toUpperCase(), marginX + 8, cursorY - 13, 9.6, true, color.title);
        cursorY -= 24;

        if (block.subtitle) {
          text(block.subtitle, marginX + 8, cursorY - 2, 8.2, false, color.muted);
          cursorY -= 16;
        }

        if (!summaryCardDrawn) {
          drawSummaryCard();
        }
        pageHasContent = true;
        return;
      }

      ensureSpace(block.subtitle ? 38 : 26);
      rect(marginX, cursorY - 18, contentWidth, 18, color.paleGray, color.border);
      text(block.heading.toUpperCase(), marginX + 8, cursorY - 12, 8.4, true, color.title);
      cursorY -= 22;

      if (block.subtitle) {
        text(block.subtitle, marginX + 8, cursorY - 2, 8.2, false, color.muted);
        cursorY -= 14;
      }

      pageHasContent = true;
    };
    const drawStructuredTable = (block: ReportTableBlock) => {
      const widths = tableColumnWidths(block.columns);
      const rowFontSize = 7.2;
      const headerHeight = 15;
      const lineHeight = 8.4;
      const rowPaddingY = 5;
      const wrappedRows = block.rows.map((row) => {
        const cellLines = row.map((cell, index) => {
          const limit = Math.max(5, Math.floor(((widths[index] || 80) - 12) / (rowFontSize * 0.52)));
          return wrap(cell || '-', limit).slice(0, 2);
        });
        const rowHeight = Math.max(18, rowPaddingY * 2 + Math.max(...cellLines.map((lines) => lines.length), 1) * lineHeight);

        return { cellLines, rowHeight };
      });
      const drawColumnHeader = () => {
        let x = marginX;

        rect(marginX, cursorY - headerHeight, contentWidth, headerHeight, color.blue);
        block.columns.forEach((column, index) => {
          alignedText(column, x, cursorY - 10, widths[index], 6.2, true, color.white, columnAlignment(column));
          x += widths[index];
        });
        cursorY -= headerHeight;
      };
      const drawContinuationTitle = () => {
        if (!block.heading) {
          return;
        }

        text(`${block.heading} (continued)`, marginX, cursorY - 8, 8.6, true, color.title);
        cursorY -= 14;
      };

      const firstRowHeight = wrappedRows[0]?.rowHeight || 18;
      ensureSpace((block.heading ? 17 : 0) + (block.eyebrow ? 16 : 0) + headerHeight + firstRowHeight + 8);

      if (block.heading) {
        text(block.heading, marginX, cursorY - 8, 9.6, true, color.title);

        if (block.totals?.length) {
          const totals = `UNIT TOTALS  ${block.totals.join('   ')}`;
          const fitsInline = textWidth(block.heading, 9.6, true) + textWidth(totals, 6.6, true) < contentWidth - 18;

          if (fitsInline) {
            rightText(totals, pageWidth - marginX, cursorY - 8, 6.6, true, color.muted);
          } else {
            wrap(totals, 58).slice(0, 2).forEach((totalLine, lineIndex) => {
              rightText(totalLine, pageWidth - marginX, cursorY - 8 - lineIndex * 8, 6.6, true, color.muted);
            });
            cursorY -= 8;
          }
        }

        cursorY -= 14;
      }

      if (block.eyebrow) {
        rect(marginX, cursorY - 14, contentWidth, 14, color.paleBlue, color.border);
        text(block.eyebrow.toUpperCase(), marginX + 8, cursorY - 9, 6.8, true, color.ink);
        cursorY -= 14;
      }

      drawColumnHeader();

      wrappedRows.forEach(({ cellLines, rowHeight }, rowIndex) => {
        if (cursorY - rowHeight < bottomMargin) {
          startPage();
          drawContinuationTitle();
          drawColumnHeader();
        }

        const rowTop = cursorY;
        if (rowIndex % 2 === 0) {
          rect(marginX, rowTop - rowHeight, contentWidth, rowHeight, color.paleGray);
        }

        let x = marginX;
        cellLines.forEach((lines, columnIndex) => {
          const column = block.columns[columnIndex] || '';
          const align = columnAlignment(column);
          const fill = column.toLowerCase() === 'stock' ? color.muted : color.ink;
          lines.forEach((wrapped, lineIndex) => {
            const isPrimary = columnIndex === 0 && lineIndex === 0;
            alignedText(wrapped, x, rowTop - rowPaddingY - 7 - lineIndex * lineHeight, widths[columnIndex], rowFontSize, isPrimary, fill, align);
          });
          if (columnIndex > 0) {
            line(x, rowTop, x, rowTop - rowHeight, color.border);
          }
          x += widths[columnIndex];
        });
        line(marginX, rowTop - rowHeight, pageWidth - marginX, rowTop - rowHeight, color.border);
        cursorY -= rowHeight;
        pageHasContent = true;
      });

      cursorY -= 7;
      pageHasContent = true;
    };
    const drawReportBlock = (block: ReportBlock) => {
      if (block.type === 'heading') {
        drawHeadingBlock(block);
        return;
      }

      drawStructuredTable(block);
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
    if (structuredBlocks.length) {
      structuredBlocks.forEach((block) => drawReportBlock(block));
    } else {
      sections.forEach((section) => drawTable(section));
    }

    const pageStreams = pages.map((pageCommands, pageIndex) => {
      if (!structuredBlocks.length) {
        pageCommands.push('0.35 0.38 0.45 rg');
        pageCommands.push(`BT /F1 8 Tf ${marginX} 26 Td (${this.escapePdfText(`${this.appName} report - Page ${pageIndex + 1} of ${pages.length}`)}) Tj ET`);
        pageCommands.push(`BT /F1 8 Tf ${pageWidth - 156} 26 Td (${this.escapePdfText(payload.source || location.pathname)}) Tj ET`);
      }
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
