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

            if (string.IsNullOrWhiteSpace(resourceKeySuffix))
            {
                resourceKeySuffix = string.Empty;
            }
            else
            {
                resourceKeySuffix = "_" + resourceKeySuffix;
            }

            // Search by name from more specific to less specific
            var resourceKeyName = fullPropertyName.Replace('.', '_').Replace('+', '_');
            var namePartsCount = resourceKeyName.Length - resourceKeyName.Replace("_", string.Empty).Length + 1;
            resourceKeyName += resourceKeySuffix;

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
