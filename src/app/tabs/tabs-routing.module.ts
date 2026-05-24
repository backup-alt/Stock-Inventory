import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('../tab1/tab1.module').then(m => m.Tab1PageModule)
      },
      {
        path: 'overall-report',
        loadChildren: () => import('../tab2/tab2.module').then(m => m.Tab2PageModule)
      },
      {
        path: 'stock-report',
        loadChildren: () => import('../tab3/tab3.module').then(m => m.Tab3PageModule)
      },
      {
        path: 'product-info',
        loadChildren: () => import('../pages/product-info/product-info.module').then(m => m.ProductInfoPageModule)
      },
      {
        path: 'production-log',
        loadChildren: () => import('../pages/production-log/production-log.module').then(m => m.ProductionLogPageModule)
      },
      {
        path: 'recent-entries',
        loadChildren: () => import('../pages/recent-entries/recent-entries.module').then(m => m.RecentEntriesPageModule)
      },
      {
        path: 'inventory/raw-salt',
        loadChildren: () => import('../pages/inventory-raw-salt/inventory-raw-salt.module').then(m => m.InventoryRawSaltPageModule)
      },
      {
        path: 'inventory/bundles',
        loadChildren: () => import('../pages/inventory-bundles/inventory-bundles.module').then(m => m.InventoryBundlesPageModule)
      },
      {
        path: 'inventory/packaging',
        loadChildren: () => import('../pages/inventory-packaging/inventory-packaging.module').then(m => m.InventoryPackagingPageModule)
      },
      {
        path: 'inventory/packaging-rolls',
        loadChildren: () => import('../pages/inventory-packaging/inventory-packaging.module').then(m => m.InventoryPackagingPageModule)
      },
      {
        path: 'inventory/packaging-bags',
        loadChildren: () => import('../pages/inventory-packaging/inventory-packaging.module').then(m => m.InventoryPackagingPageModule)
      },
      {
        path: 'inventory/consumables',
        loadChildren: () => import('../pages/inventory-consumables/inventory-consumables.module').then(m => m.InventoryConsumablesPageModule)
      },
      {
        path: 'inventory/crystalline',
        loadChildren: () => import('../pages/inventory-crystalline/inventory-crystalline.module').then(m => m.InventoryCrystallinePageModule)
      },
      {
        path: '',
        redirectTo: '/tabs/dashboard',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/tabs/dashboard',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}
