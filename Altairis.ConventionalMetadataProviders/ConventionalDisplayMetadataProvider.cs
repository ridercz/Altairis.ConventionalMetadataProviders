using System;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Resources;
using Microsoft.AspNetCore.Mvc.ModelBinding.Metadata;
using Microsoft.Extensions.Logging;

namespace Altairis.ConventionalMetadataProviders {
    public class ConventionalDisplayMetadataProvider : IDisplayMetadataProvider {
        private readonly ResourceManager _resourceManager;
        private readonly Type _resourceType;

        public ConventionalDisplayMetadataProvider(Type resourceType) {
            this._resourceType = resourceType ?? throw new ArgumentNullException(nameof(resourceType));
            this._resourceManager = new ResourceManager(resourceType);
        }

        public void CreateDisplayMetadata(DisplayMetadataProviderContext context) {
            if (context == null) throw new ArgumentNullException(nameof(context));

            this.UpdateDisplayName(context);
            this.UpdateDescription(context);
            this.UpdatePlaceholder(context);
            this.UpdateNullDisplayText(context);
            this.UpdateDisplayFormatString(context);
            this.UpdateEditorFormatString(context);
        }

        private void UpdateDisplayName(DisplayMetadataProviderContext context) {
            // Special cases
            if (string.IsNullOrWhiteSpace(context.Key.Name)) return;
            if (!string.IsNullOrWhiteSpace(context.DisplayMetadata.SimpleDisplayProperty)) return;
            if (context.Attributes.OfType<DisplayNameAttribute>().Any(x => !string.IsNullOrWhiteSpace(x.DisplayName))) return;
            if (context.Attributes.OfType<DisplayAttribute>().Any(x => !string.IsNullOrWhiteSpace(x.Name))) return;

            // Try get resource key name
            var keyName = this.GetResourceKeyName(context.Key, "Name") ?? this.GetResourceKeyName(context.Key, null);
            if (keyName != null) context.DisplayMetadata.DisplayName = () => this._resourceManager.GetString(keyName);
        }

        private void UpdateDescription(DisplayMetadataProviderContext context) {
            // Special cases
            if (context.Attributes.OfType<DisplayAttribute>().Any(x => !string.IsNullOrWhiteSpace(x.Description))) return;

            // Try get resource key name
            var keyName = this.GetResourceKeyName(context.Key, "Description");
            if (keyName != null) context.DisplayMetadata.Description = () => this._resourceManager.GetString(keyName);
        }

        private void UpdatePlaceholder(DisplayMetadataProviderContext context) {
            // Special cases
            if (context.Attributes.OfType<DisplayAttribute>().Any(x => !string.IsNullOrWhiteSpace(x.Prompt))) return;

            // Try get resource key name
            var keyName = this.GetResourceKeyName(context.Key, "Placeholder");
            if (keyName != null) context.DisplayMetadata.Placeholder = () => this._resourceManager.GetString(keyName);
        }

        private void UpdateNullDisplayText(DisplayMetadataProviderContext context) {
            var keyName = this.GetResourceKeyName(context.Key, "Null");
            if (keyName != null) context.DisplayMetadata.NullDisplayTextProvider = () => this._resourceManager.GetString(keyName);
        }

        private void UpdateDisplayFormatString(DisplayMetadataProviderContext context) {
            var keyName = this.GetResourceKeyName(context.Key, "DisplayFormat");
            if (keyName != null) context.DisplayMetadata.DisplayFormatStringProvider = () => this._resourceManager.GetString(keyName);
        }

        private void UpdateEditorFormatString(DisplayMetadataProviderContext context) {
            var keyName = this.GetResourceKeyName(context.Key, "EditFormat");
            if (keyName != null) context.DisplayMetadata.EditFormatStringProvider = () => this._resourceManager.GetString(keyName);
        }

        private string GetResourceKeyName(ModelMetadataIdentity metadataIdentity, string resourceKeySuffix) {
            if (string.IsNullOrEmpty(metadataIdentity.Name)) return null;

            string fullPropertyName;
            if (!string.IsNullOrEmpty(metadataIdentity.ContainerType?.FullName)) {
                fullPropertyName = metadataIdentity.ContainerType.FullName + "." + metadataIdentity.Name;
            }
            else {
                fullPropertyName = metadataIdentity.Name;
            }

            // Search by name from more specific to less specific
            var nameParts = fullPropertyName.Split('.', '+');
            for (var i = 0; i < nameParts.Length; i++) {
                // Get the resource key to lookup
                var resourceKeyName = string.Join("_", nameParts.Skip(i));
                if (!string.IsNullOrWhiteSpace(resourceKeySuffix)) resourceKeyName += "_" + resourceKeySuffix;

                // Check if given value exists in resource
                var keyExists = !string.IsNullOrWhiteSpace(this._resourceManager.GetString(resourceKeyName));
                if (keyExists) return resourceKeyName;
            }

            // Not found
            return null;
        }

    }
}
