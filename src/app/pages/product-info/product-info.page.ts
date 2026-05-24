import { Component, OnInit } from '@angular/core';
import { DataService } from '../../core/services/data.service';
import { ProductInfoData, RecentEntry } from '../../core/models/inventory.models';

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
    this.syncUpdateForm();
    this.showUpdateInventory = true;
  }

  closeUpdateInventory() {
    if (this.isSavingUpdate) {
      return;
    }

    this.showUpdateInventory = false;
  }

  onCategoryChange() {
    this.selectedItemIndex = 0;
    this.syncUpdateForm();
  }

  onItemChange() {
    this.syncUpdateForm();
  }

  saveInventoryUpdate() {
    if (!this.data) {
      return;
    }

    this.updateError = '';
    const item = this.data.inventoryCategories[this.selectedCategoryIndex]?.items[this.selectedItemIndex];
    const category = this.data.inventoryCategories[this.selectedCategoryIndex];
    if (!item) {
      return;
    }

    const quantity = Number(this.updateQuantity) || 0;
    this.isSavingUpdate = true;
    this.dataService.createInventoryUpdate({
      category: category.title,
      productGroup: item.name,
      quantity,
      note: this.updateNote
    }).subscribe({
      next: () => {
        item.quantity = quantity;
        item.status = this.statusFromQuantity(quantity);
        const entry: RecentEntry = {
          type: 'inbound',
          label: 'Manual inventory update',
          date: 'Just now',
          quantity: `${item.quantity} ${item.unit}`,
          source: this.updateNote || 'Owner update',
          icon: 'edit'
        };
        this.data!.recentEntries = [
          entry,
          ...this.data!.recentEntries
        ].slice(0, 4);
        this.isSavingUpdate = false;
        this.showUpdateInventory = false;
      },
      error: () => {
        this.isSavingUpdate = false;
        this.updateError = 'Unable to save the inventory update. Please try again.';
      }
    });
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
    const item = this.data?.inventoryCategories[this.selectedCategoryIndex]?.items[this.selectedItemIndex];
    if (!item) {
      this.updateQuantity = 0;
      return;
    }

    this.updateQuantity = item.quantity;
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
    refresher?.target?.complete();
  }
}
