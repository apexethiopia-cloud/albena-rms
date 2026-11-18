import { PageHeader } from '@/components/PageHeader'
import { RecipesPanel } from '@/features/recipes/RecipesPanel'
import { ProductionPanel } from '@/features/production/ProductionPanel'

export function Kitchen() {
  return (
    <>
      <PageHeader
        title="Kitchen"
        description="Recipe versions with live food costing, and production orders that consume ingredient layers and create finished stock when posted."
      />

      <div className="space-y-6">
        <RecipesPanel />

        <ProductionPanel />
      </div>
    </>
  )
}
