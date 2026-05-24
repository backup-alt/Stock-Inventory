import { Component, OnInit } from '@angular/core';
import { DataService } from '../../core/services/data.service';
import { InventoryCategory, InventoryItem, ProductInfoData, RecentEntry } from '../../core/models/inventory.models';

type ProductEntryMode = 'existing' | 'custom';

@Component({
  selector: 'app-product-info',
  templateUrl: './product-info.page.html',
  styleUrls: ['./product-info.page.scss'],
  standalone: false,
})
export class ProductInfoPage implements OnInit {
  data: ProductInfoData | null = null;
  isLoading = true;
  hasError = false;
  showUpdateInventory = false;
  selectedCategoryIndex = 0;
  selectedItemIndex = 0;
  productEntryMode: ProductEntryMode = 'existing';
  customProductName = '';
  customUnit = '';
  updateQuantity = 0;
  updateNote = '';
  isSavingUpdate = false;
  updateError = '';

  constructor(private dataService: DataService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData(refresher?: any) {
    if (!refresher) {
      this.isLoading = true;
    }
    this.hasError = false;
    this.dataService.getProductInfo().subscribe({
      next: (data) => {
        this.data = data;
        this.isLoading = false;
        this.completeRefresh(refresher);
      },
      error: () => {
        this.hasError = true;
        this.isLoading = false;
        this.completeRefresh(refresher);
      }
    });
  }

  openUpdateInventory() {
    this.selectedCategoryIndex = 0;
    this.selectedItemIndex = 0;
    this.productEntryMode = 'existing';
    this.customProductName = '';
    this.customUnit = this.defaultUnitForSelectedCategory();
    this.updateNote = '';
    this.updateError = '';
    this.syncUpdateForm();
    this.showUpdateInventory = true;
  }

  closeUpdateInventory() {
    if (this.isSavingUpdate) {
      return;
    }

    this.showUpdateInventory = false;
  }

  keepFocusedControlVisible(event: FocusEvent) {
    const target = event.target;

    if (!(target instanceof HTMLElement) || !target.matches('input, select, textarea')) {
      return;
    }

    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 180);
  }

  onCategoryChange() {
    this.selectedItemIndex = 0;
    this.productEntryMode = 'existing';
    this.customProductName = '';
    this.customUnit = this.defaultUnitForSelectedCategory();
    this.syncUpdateForm();
  }

  onItemChange() {
    this.syncUpdateForm();
  }

  setProductEntryMode(mode: ProductEntryMode) {
    this.productEntryMode = mode;
    this.updateError = '';

    if (mode === 'existing') {
      this.syncUpdateForm();
      return;
    }

    this.updateQuantity = 0;
    this.customUnit = this.defaultUnitForSelectedCategory();
  }

  saveInventoryUpdate() {
    if (!this.data) {
      return;
    }

    this.updateError = '';
    const category = this.selectedCategory;
    const existingItem = this.selectedItem;
    const productName = this.selectedProductName();
    const unit = this.selectedProductUnit();

    if (!category || !productName) {
      this.updateError = 'Choose a product or type a new product name.';
      return;
    }

    const quantity = Number(this.updateQuantity) || 0;
    this.isSavingUpdate = true;
    this.dataService.createInventoryUpdate({
      category: category.title,
      productGroup: productName,
      quantity,
      unit,
      note: this.updateNote
    }).subscribe({
      next: (response) => {
        const item = this.productEntryMode === 'custom'
          ? this.insertCustomItem(category, productName, quantity, unit)
          : existingItem;

        if (!item) {
          this.isSavingUpdate = false;
          this.showUpdateInventory = false;
          return;
        }

        const savedUpdate = response.data;
        item.quantity = savedUpdate.quantity;
        item.unit = savedUpdate.unit;
        item.status = this.statusFromQuantity(savedUpdate.quantity);
        const entry: RecentEntry = {
          type: 'inbound',
          label: savedUpdate.productGroup,
          category: savedUpdate.category,
          productName: savedUpdate.productGroup,
          date: 'Just now',
          quantity: `${savedUpdate.quantity} ${savedUpdate.unit}`,
          note: savedUpdate.note || 'Owner inventory update',
          source: savedUpdate.category,
          icon: 'edit'
        };
        this.data!.recentEntries = [
          entry,
          ...this.data!.recentEntries
        ].slice(0, 4);
        this.isSavingUpdate = false;
        this.showUpdateInventory = false;
        this.customProductName = '';
        this.updateNote = '';
      },
      error: () => {
        this.isSavingUpdate = false;
        this.updateError = 'Unable to save the inventory update. Please try again.';
      }
    });
  }

  get selectedCategory(): InventoryCategory | null {
    return this.data?.inventoryCategories[this.selectedCategoryIndex] ?? null;
  }

  get selectedItem(): InventoryItem | null {
    return this.selectedCategory?.items[this.selectedItemIndex] ?? null;
  }

  get canSaveUpdate(): boolean {
    return !this.isSavingUpdate && Boolean(this.selectedCategory && this.selectedProductName());
  }

  getCategoryRoute(title: string): string {
    const normalizedTitle = title.toLowerCase();

    if (normalizedTitle.includes('raw')) {
      return '/tabs/inventory/raw-salt';
    }

    if (normalizedTitle.includes('bundle')) {
      return '/tabs/inventory/bundles';
    }

    if (normalizedTitle.includes('packaging') && normalizedTitle.includes('roll')) {
      return '/tabs/inventory/packaging-rolls';
    }

    if (normalizedTitle.includes('packaging') && normalizedTitle.includes('bag')) {
      return '/tabs/inventory/packaging-bags';
    }

    if (normalizedTitle.includes('packaging')) {
      return '/tabs/inventory/packaging';
    }

    if (normalizedTitle.includes('consumable')) {
      return '/tabs/inventory/consumables';
    }

    if (normalizedTitle.includes('crystalline') || normalizedTitle.includes('crystal')) {
      return '/tabs/inventory/crystalline';
    }

    return '/tabs/stock-report';
  }

  private syncUpdateForm() {
    const item = this.selectedItem;
    if (!item) {
      this.updateQuantity = 0;
      return;
    }

    this.updateQuantity = item.quantity;
  }

  private selectedProductName(): string {
    if (this.productEntryMode === 'custom') {
      return this.customProductName.trim();
    }

    return this.selectedItem?.name ?? '';
  }

  private selectedProductUnit(): string {
    if (this.productEntryMode === 'custom') {
      return this.customUnit.trim() || this.defaultUnitForSelectedCategory();
    }

    return this.selectedItem?.unit || this.defaultUnitForSelectedCategory();
  }

  private defaultUnitForSelectedCategory(): string {
    return this.selectedCategory?.items[0]?.unit || 'Unit';
  }

  private insertCustomItem(category: InventoryCategory, name: string, quantity: number, unit: string): InventoryItem {
    const existingItem = category.items.find((item) => item.name.trim().toLowerCase() === name.trim().toLowerCase());

    if (existingItem) {
      return existingItem;
    }

    const item: InventoryItem = {
      name,
      quantity,
      unit,
      status: this.statusFromQuantity(quantity),
    };

    category.items = [item, ...category.items];
    return item;
  }

  private statusFromQuantity(quantity: number): string {
    if (quantity <= 0) {
      return 'critical';
    }

    if (quantity <= 100) {
      return 'low';
    }

    return 'ok';
  }

  private completeRefresh(refresher?: any) {
    if (!refresher) {
      return;
    }

    setTimeout(() => refresher.target?.complete(), 500);
  }
}
