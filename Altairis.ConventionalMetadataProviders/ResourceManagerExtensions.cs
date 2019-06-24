using System;
using System.Collections.Generic;
using System.Linq;
using System.Resources;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.ModelBinding.Metadata;

namespace Altairis.ConventionalMetadataProviders {
    internal static class ResourceManagerExtensions {
        public static string GetResourceKeyName(this ResourceManager resourceManager, ModelMetadataIdentity metadataIdentity, string resourceKeySuffix) {
            if (resourceManager == null) throw new ArgumentNullException(nameof(resourceManager));
            if (string.IsNullOrEmpty(metadataIdentity.Name)) return null;

            var fullPropertyName = !string.IsNullOrEmpty(metadataIdentity.ContainerType?.FullName)
                ? metadataIdentity.ContainerType.FullName + "." + metadataIdentity.Name
                : metadataIdentity.Name;

            // Search by name from more specific to less specific
            var nameParts = fullPropertyName.Split('.', '+');
            for (var i = 0; i < nameParts.Length; i++) {
                // Get the resource key to lookup
                var resourceKeyName = string.Join("_", nameParts.Skip(i));
                if (!string.IsNullOrWhiteSpace(resourceKeySuffix)) resourceKeyName += "_" + resourceKeySuffix;

                // Check if given value exists in resource
                if (resourceManager.GetString(resourceKeyName) != null) return resourceKeyName;
            }

            // Not found
            return null;
        }
    }
}
