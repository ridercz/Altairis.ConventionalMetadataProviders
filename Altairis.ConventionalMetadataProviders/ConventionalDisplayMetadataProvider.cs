using System;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Resources;
using Microsoft.AspNetCore.Mvc.ModelBinding.Metadata;

namespace Altairis.ConventionalMetadataProviders {
    public class ConventionalDisplayMetadataProvider : IDisplayMetadataProvider {
        private readonly ResourceManager _resourceManager;
        private readonly Type _resourceType;
        private readonly int _maxNamePartsScanCount;

        public ConventionalDisplayMetadataProvider(Type resourceType, int maxNamePartsScanCount = 3) {
            if (maxNamePartsScanCount < 1) throw new ArgumentOutOfRangeException(nameof(maxNamePartsScanCount));

            _resourceType = resourceType ?? throw new ArgumentNullException(nameof(resourceType));
            _resourceManager = new ResourceManager(resourceType);
            _maxNamePartsScanCount = maxNamePartsScanCount;
        }

        public void CreateDisplayMetadata(DisplayMetadataProviderContext context) {
            if (context == null) throw new ArgumentNullException(nameof(context));

            this.UpdateDisplayName(context);
            this.UpdateDescription(context);
            this.UpdatePlaceholder(context);
            this.UpdateNullDisplayText(context);
            this.UpdateDisplayFormatString(context);
            this.UpdateEditFormatString(context);
        }

        private void UpdateDisplayName(DisplayMetadataProviderContext context) {
            // Special cases
            if (string.IsNullOrWhiteSpace(context.Key.Name)) return;
            if (!string.IsNullOrWhiteSpace(context.DisplayMetadata.SimpleDisplayProperty)) return;
            if (context.Attributes.OfType<DisplayNameAttribute>().Any(x => !string.IsNullOrWhiteSpace(x.DisplayName))) return;
            if (context.Attributes.OfType<DisplayAttribute>().Any(x => !string.IsNullOrWhiteSpace(x.Name))) return;

            // Try get name
            var value = this.GetValueFromResource(context.Key, null);
            if (value != null) context.DisplayMetadata.DisplayName = () => value;
        }

        private void UpdateDescription(DisplayMetadataProviderContext context) {
            // Special cases
            if (context.Attributes.OfType<DisplayAttribute>().Any(x => !string.IsNullOrWhiteSpace(x.Description))) return;

            // Try get value from resource
            var value = this.GetValueFromResource(context.Key, "Description");
            if (value != null) context.DisplayMetadata.Description = () => value;
        }

        private void UpdatePlaceholder(DisplayMetadataProviderContext context) {
            // Special cases
            if (context.Attributes.OfType<DisplayAttribute>().Any(x => !string.IsNullOrWhiteSpace(x.Prompt))) return;

            // Try get value from resource
            var value = this.GetValueFromResource(context.Key, "Placeholder");
            if (value != null) context.DisplayMetadata.Placeholder = () => value;
        }

        private void UpdateNullDisplayText(DisplayMetadataProviderContext context) {
            var value = this.GetValueFromResource(context.Key, "NullDisplayText");
            if (value != null) context.DisplayMetadata.Placeholder = () => value;
        }

        private void UpdateDisplayFormatString(DisplayMetadataProviderContext context) {
            var value = this.GetValueFromResource(context.Key, "DisplayFormatString")
                     ?? this.GetValueFromResource(context.Key, "FormatString");
            if (value != null) context.DisplayMetadata.DisplayFormatString = value;
        }

        private void UpdateEditFormatString(DisplayMetadataProviderContext context) {
            var value = this.GetValueFromResource(context.Key, "EditEditFormatString")
                     ?? this.GetValueFromResource(context.Key, "FormatString");
            if (value != null) context.DisplayMetadata.EditFormatString = value;
        }

        private string GetValueFromResource(ModelMetadataIdentity metadataIdentity, string resourceKeySuffix) {
            if (string.IsNullOrEmpty(metadataIdentity.Name)) return null;

            string fullPropertyName;
            if (string.IsNullOrEmpty(metadataIdentity.ContainerType?.FullName)) {
                fullPropertyName = metadataIdentity.ContainerType.FullName + "." + metadataIdentity.Name;
            }
            else {
                fullPropertyName = metadataIdentity.Name;
            }

            // Search by name from more specific to less specific
            var nameParts = fullPropertyName.Split('.', '+');
            var namePartsCount = nameParts.Length;
            var skipCount = 0;
            if (namePartsCount > _maxNamePartsScanCount) skipCount = namePartsCount - _maxNamePartsScanCount;

            while (skipCount < namePartsCount) {
                // Get the resource key to lookup
                var resourceKeyName = string.Join("_", nameParts.Skip(skipCount));
                if (!string.IsNullOrWhiteSpace(resourceKeySuffix)) resourceKeyName += "_" + resourceKeySuffix;

                // Check if given value exists in resource
                var value = _resourceManager.GetString(resourceKeyName);
                if (value != null) return value;
                skipCount++;
            }

            // Resource was not found
            return null;
        }

    }
}
