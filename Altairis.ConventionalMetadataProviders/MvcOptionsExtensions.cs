using System;
using System.Collections.Generic;
using System.Linq;
using System.Resources;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace Altairis.ConventionalMetadataProviders {
    public static class MvcOptionsExtensions {


        public static void SetConventionalMetadataProviders<TDisplayResource>(this MvcOptions options) {
            options.SetConventionalMetadataProviders(typeof(TDisplayResource));
        }

        public static void SetConventionalMetadataProviders<TDisplayResource, TValidationResource>(this MvcOptions options) {
            options.SetConventionalMetadataProviders(typeof(TDisplayResource), typeof(TValidationResource));
        }
                public static void SetConventionalMetadataProviders<TDisplayResource, TValidationResource, TBindingResource>(this MvcOptions options) {
            options.SetConventionalMetadataProviders(typeof(TDisplayResource), typeof(TValidationResource), typeof(TBindingResource));
        }

        public static void SetConventionalMetadataProviders(this MvcOptions options, Type displayMetadataResourceType, Type validationResourceType = null, Type bindingResourceType = null) {
            if (options == null) throw new ArgumentNullException(nameof(options));
            if (validationResourceType == null) validationResourceType = typeof(Resources.DefaultValidationMessages);
            if (bindingResourceType == null) bindingResourceType = typeof(Resources.DefaultBindingMessages);

            // Localize binding error messages
            var brm = new ResourceManager(bindingResourceType);
            options.ModelBindingMessageProvider.SetAttemptedValueIsInvalidAccessor((s1, s2) => string.Format(brm.GetString("AttemptedValueIsInvalid"), s1, s2));
            options.ModelBindingMessageProvider.SetMissingBindRequiredValueAccessor(s => string.Format(brm.GetString("MissingBindRequiredValue"), s));
            options.ModelBindingMessageProvider.SetMissingKeyOrValueAccessor(() => brm.GetString("MissingKeyOrValue"));
            options.ModelBindingMessageProvider.SetMissingRequestBodyRequiredValueAccessor(() => brm.GetString("MissingRequestBodyRequiredValue"));
            options.ModelBindingMessageProvider.SetNonPropertyAttemptedValueIsInvalidAccessor(s => string.Format(brm.GetString("NonPropertyAttemptedValueIsInvalid"), s));
            options.ModelBindingMessageProvider.SetNonPropertyUnknownValueIsInvalidAccessor(() => brm.GetString("NonPropertyUnknownValueIsInvalid"));
            options.ModelBindingMessageProvider.SetNonPropertyValueMustBeANumberAccessor(() => brm.GetString("NonPropertyValueMustBeANumber"));
            options.ModelBindingMessageProvider.SetUnknownValueIsInvalidAccessor(s => string.Format(brm.GetString("UnknownValueIsInvalid"), s));
            options.ModelBindingMessageProvider.SetValueIsInvalidAccessor(s => string.Format(brm.GetString("ValueIsInvalid"), s));
            options.ModelBindingMessageProvider.SetValueMustBeANumberAccessor(s => string.Format(brm.GetString("ValueMustBeANumber"), s));
            options.ModelBindingMessageProvider.SetValueMustNotBeNullAccessor(s => string.Format(brm.GetString("ValueMustNotBeNull"), s));

            // Localize display metadata
            options.ModelMetadataDetailsProviders.Add(new ConventionalDisplayMetadataProvider(displayMetadataResourceType));

            // Localize validation metadata
            options.ModelMetadataDetailsProviders.Add(new ConventionalValidationMetadataProvider(validationResourceType));
        }
    }
}
