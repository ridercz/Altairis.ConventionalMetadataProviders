using System;
using System.Collections.Generic;
using System.Linq;
using System.Resources;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.ModelBinding.Metadata;

namespace Altairis.ConventionalMetadataProviders {
    internal static class ResourceManagerExtensions {
        public static string GetResourceKeyName(this ResourceManager resourceManager, ModelMetadataIdentity metadataIdentity, string resourceKeySuffix, bool allowSuffixOnly = false) {
            if (resourceManager == null) throw new ArgumentNullException(nameof(resourceManager));
            if (string.IsNullOrEmpty(metadataIdentity.Name)) return null;

            // Get full property name, ie. Namespace.Class.Property
            var fullPropertyName = !string.IsNullOrEmpty(metadataIdentity.ContainerType?.FullName)
                ? metadataIdentity.ContainerType.FullName + "." + metadataIdentity.Name
                : metadataIdentity.Name;

            // Start with resource key name equal to full property name, with "+" and "." replaced by "_"
            var resourceKeyName = fullPropertyName.Replace('.', '_').Replace('+', '_');

            // Get number of parts, ie. Namespace.Class.Property has 3
            var namePartsCount = resourceKeyName.Length - resourceKeyName.Replace("_", string.Empty).Length + 1;

            // Add suffix if specified
            if (!string.IsNullOrWhiteSpace(resourceKeySuffix)) {
                resourceKeyName += "_" + resourceKeySuffix;
                if (allowSuffixOnly) namePartsCount++;
            }

            // Search by name from more specific to less specific
            for (var i = 0; i < namePartsCount; i++) {
                // Get the resource key to lookup
                if (i > 0) resourceKeyName = resourceKeyName.Substring(resourceKeyName.IndexOf("_") + 1);

                // Check if given value exists in resource
                if (resourceManager.GetString(resourceKeyName) != null) return resourceKeyName;
            }

            // Not found
            return null;
        }
    }
}
